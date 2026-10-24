const { reportError } = require('../utils/logger');
const express = require('express');
const auth = require('../middleware/auth');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const FeePayment = require('../models/FeePayment');
const { privateFeeFields, automaticallyPaid, currentBillingPeriod } = require('../utils/feePolicy');
const { attendancePercentage, attendancePeriod, summarizeAttendance, studentAttendanceSummaries } = require('../utils/attendanceStats');
const { objectId, integer, dateOnly, teacherQuery } = require('../middleware/validation');

const router = express.Router();

// Require auth and verify user role is 'teacher'
router.use(auth);
router.use((req, res, next) => {
  if (req.userRole !== 'teacher') {
    return res.status(403).json({ message: 'Forbidden. Teacher access required.' });
  }
  next();
});
router.use(teacherQuery);

/**
 * GET /api/teacher/dashboard
 * Return summary metrics, Recharts trends, and assigned student overview.
 * Respects Enrollment Date Filtering (current month end-date limit).
 */
router.get('/dashboard', async (req, res) => {
  try {
    const teacherId = req.userId;

    const { month: currentMonth, year: currentYear } = currentBillingPeriod();
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 1) - 1);
    const students = await Student.find({ assignedTeacher: teacherId, enrollmentDate: { $lte: endOfMonth } })
      .select('name rollNumber fees +feeExempt +feeExemptFrom').sort({ name: 1 }).lean();
    const totalStudents = students.length;
    const counts = {
      absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
      present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
    };
    const monthFilter = { teacher: teacherId, date: { $gte: startOfMonth, $lte: endOfMonth } };
    const [monthlyFeePayments, overallStats, monthlyStats, dailyTrends] = await Promise.all([
      FeePayment.find({ student: { $in: students.map((student) => student._id) }, month: currentMonth, year: currentYear })
        .select('student status').lean(),
      Attendance.aggregate([{ $match: { teacher: teacherId } }, { $group: { _id: '$student', ...counts } }]),
      Attendance.aggregate([{ $match: monthFilter }, { $group: { _id: null, ...counts } }]),
      Attendance.aggregate([{ $match: monthFilter },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, ...counts } }, { $sort: { _id: 1 } }]),
    ]);
    const paidStudentSet = new Set(monthlyFeePayments.filter((payment) => payment.status === 'submitted')
      .map((payment) => payment.student.toString()));
    let feeReceived = 0, feeRemaining = 0;
    for (const student of students) {
      if (automaticallyPaid(student, currentMonth, currentYear)) continue;
      if (paidStudentSet.has(student._id.toString())) feeReceived += student.fees || 0;
      else feeRemaining += student.fees || 0;
    }
    const statsMap = new Map(overallStats.map((stat) => [String(stat._id), attendancePercentage(stat.present, stat.absent)]));
    const studentOverview = students.map((student) => ({ _id: student._id, name: student.name,
      rollNumber: student.rollNumber, attendancePercentage: statsMap.get(String(student._id)) ?? 0 }));
    const monthlyPresentPct = attendancePercentage(monthlyStats[0]?.present || 0, monthlyStats[0]?.absent || 0);
    const attendanceTrends = dailyTrends.map((trend) => ({ date: trend._id,
      percentage: attendancePercentage(trend.present, trend.absent) }));

    res.json({
      metrics: {
        feeReceived,
        feeRemaining,
        totalStudents,
      },
      monthlyPresentPct,
      attendanceTrends,
      students: studentOverview,
    });
  } catch (error) {
    reportError(error, 'teacher_dashboard_error', req);
    res.status(500).json({ message: 'Server error loading dashboard metrics.' });
  }
});

/**
 * GET /api/teacher/attendance
 * Return students with their attendance status for a selected date.
 * Respects Enrollment Date Filtering (roster limited to student's enrollmentDate).
 */
router.get('/attendance', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required (YYYY-MM-DD).' });
    }

    const teacherId = req.userId;
    const targetDate = new Date(date + 'T00:00:00.000Z');

    // Get all eligible assigned students (respect enrollment date)
    const students = await Student.find({
      assignedTeacher: teacherId,
      enrollmentDate: { $lte: targetDate }
    }).sort({ name: 1 });

    // Get attendance records for this date
    const attendanceRecords = await Attendance.find({
      teacher: teacherId,
      date: targetDate,
    });

    const isSubmitted = attendanceRecords.length > 0;

    // Create lookup map
    const statusMap = {};
    attendanceRecords.forEach((rec) => {
      statusMap[rec.student.toString()] = rec.status;
    });

    // Format list
    const studentList = students.map((s) => ({
      _id: s._id,
      name: s.name,
      rollNumber: s.rollNumber,
      status: statusMap[s._id.toString()] || 'present', // Default to present for new records
    }));

    res.json({
      date,
      isSubmitted,
      students: studentList,
    });
  } catch (error) {
    reportError(error, 'fetch_attendance_error', req);
    res.status(500).json({ message: 'Server error fetching attendance.' });
  }
});

/**
 * DELETE /api/teacher/attendance
 * Delete/reset all attendance records for a specific date
 */
router.delete('/attendance', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ message: 'Date parameter is required (YYYY-MM-DD).' });
    }

    const teacherId = req.userId;
    const targetDate = new Date(date + 'T00:00:00.000Z');

    const result = await Attendance.deleteMany({
      teacher: teacherId,
      date: targetDate,
    });

    console.log(`Deleted ${result.deletedCount} attendance records for teacher ${teacherId} on ${date}`);

    res.json({
      message: `Attendance records for ${date} reset successfully.`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    reportError(error, 'delete_attendance_error', req);
    res.status(500).json({ message: 'Server error resetting attendance.' });
  }
});

/**
 * POST /api/teacher/attendance
 * Submit/update attendance records for a specific date
 */
router.post('/attendance', async (req, res) => {
  try {
    const { date, records } = req.body;
    if (!dateOnly(date) || !Array.isArray(records) || records.length < 1 || records.length > 2000 ||
        records.some((record) => !record || typeof record !== 'object' || !objectId(record.studentId) ||
          !['present', 'absent', 'leave'].includes(record.status)) ||
        new Set(records.map((record) => record.studentId.toLowerCase())).size !== records.length) {
      return res.status(400).json({ message: 'Date and records array are required.' });
    }

    const teacherId = req.userId;
    const targetDate = new Date(date + 'T00:00:00.000Z');

    // Reject the entire submission before any write or notification if any ID is out of scope.
    const roster = await Student.find({ _id: { $in: records.map((record) => record.studentId) },
      assignedTeacher: teacherId, enrollmentDate: { $lte: targetDate } }).select('_id').lean();
    if (roster.length !== records.length) {
      return res.status(403).json({ message: 'Attendance contains students outside your eligible roster.' });
    }
    const foreignRecord = await Attendance.exists({ student: { $in: roster.map((student) => student._id) },
      date: targetDate, teacher: { $ne: teacherId } });
    if (foreignRecord) {
      return res.status(409).json({ message: 'Attendance for this date belongs to another teacher.' });
    }

    // 1. Check if this is a new creation vs an update/edit (No-Edit rule)
    const existingRecord = await Attendance.findOne({ teacher: teacherId, date: targetDate });
    const isNewCreation = !existingRecord;

    // 2. Check if the submitted attendance date is exactly Today (Current Date check)
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = date === todayStr;

    // Create bulk operations to upsert daily records
    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { student: rec.studentId, date: targetDate, teacher: teacherId },
        update: {
          status: rec.status,
          teacher: teacherId,
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(bulkOps);

    // 3. Trigger WhatsApp notifications for absent students if the rules match
    if (isNewCreation && isToday) {
      const absentStudentIds = records
        .filter((rec) => rec.status && rec.status.toLowerCase() === 'absent')
        .map((rec) => rec.studentId);

      if (absentStudentIds.length > 0) {
        // Retrieve teacher's active WhatsApp socket (gracefully handle if missing)
        try {
          const { getWhatsAppSocket } = require('../utils/whatsappManager');
          const sock = getWhatsAppSocket(teacherId);
          if (sock) {
            // Retrieve student details (names & phone numbers)
            const students = await Student.find({ _id: { $in: absentStudentIds }, assignedTeacher: teacherId })
              .select('name phone').lean();

            // Run message dispatch in the background so it doesn't block the HTTP response
            (async () => {
              for (const student of students) {
                if (student.phone) {
                  try {
                    let cleanPhone = student.phone.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0')) {
                      cleanPhone = '92' + cleanPhone.substring(1);
                    }
                    const jid = `${cleanPhone}@s.whatsapp.net`;
                    await sock.sendMessage(jid, {
                      text: `Notice from MyAcademy: ${student.name} has been marked absent today (${date}). Please contact the administration if you have any questions.`
                    });
                  } catch (err) {
                    reportError(err, 'whatsapp_alert_failed', req);
                  }
                }
              }
            })().catch((err) => reportError(err, 'whatsapp_alert_loop_failed', req));
          } else {
            console.log(`Teacher ${teacherId} does not have an active WhatsApp session linked. Skipping absence alerts.`);
          }
        } catch (helperErr) {
          reportError(helperErr, 'graceful_whatsapp_session_helper_bypass_error', req);
        }
      } else {
        console.log('No students marked Absent in this submission. Skipping alerts.');
      }
    }

    res.status(200).json({ message: 'Attendance saved successfully.' });
  } catch (error) {
    reportError(error, 'save_attendance_error', req);
    res.status(500).json({ message: 'Server error saving attendance.' });
  }
});

/**
 * GET /api/teacher/attendance-dates
 * Return array of distinct dates (YYYY-MM-DD) with submitted attendance
 */
router.get('/attendance-dates', async (req, res) => {
  try {
    const teacherId = req.userId;

    const dates = await Attendance.distinct('date', { teacher: teacherId });

    // Format as YYYY-MM-DD
    const formattedDates = dates.map((d) => {
      return d.toISOString().split('T')[0];
    });

    res.json(formattedDates);
  } catch (error) {
    reportError(error, 'fetch_attendance_dates_error', req);
    res.status(500).json({ message: 'Server error loading calendar indicator dots.' });
  }
});

/**
 * GET /api/teacher/fee
 * Fetch students and their fee status (Submitted / Pending) for a given month and year.
 * Respects Enrollment Date Filtering (roster limited to student's enrollmentDate).
 */
router.get('/fee', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (month === undefined || !year) {
      return res.status(400).json({ message: 'Month and year are required.' });
    }

    const teacherId = req.userId;
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    // End of selected month
    const endOfPeriod = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    // Query eligible students assigned to this teacher
    const students = await Student.find({
      assignedTeacher: teacherId,
      enrollmentDate: { $lte: endOfPeriod }
    }, privateFeeFields).sort({ name: 1 });

    // Fetch fee payment records for this month/year
    const feePayments = await FeePayment.find({
      teacher: teacherId,
      month: targetMonth,
      year: targetYear
    });

    const paymentMap = {};
    feePayments.forEach((p) => {
      paymentMap[p.student.toString()] = p.status;
    });

    const studentList = students.map((s) => ({
      _id: s._id,
      name: s.name,
      rollNumber: s.rollNumber,
      status: automaticallyPaid(s, targetMonth, targetYear) ? 'submitted' : paymentMap[s._id.toString()] || 'pending'
    }));

    res.json(studentList);
  } catch (error) {
    reportError(error, 'fetch_fees_error', req);
    res.status(500).json({ message: 'Server error loading fee management roster.' });
  }
});

/**
 * POST /api/teacher/fee/pay
 * Mark student fee as paid (submitted) for a specific month and year
 */
router.post('/fee/pay', async (req, res) => {
  try {
    const { studentId, month, year } = req.body;
    if (!objectId(studentId) || !integer(month, 0, 11) || !integer(year, 1000, 9999)) {
      return res.status(400).json({ message: 'Student ID, month, and year are required.' });
    }

    const teacherId = req.userId;
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    // Verify student exists and is assigned to this teacher
    const student = await Student.findOne({ _id: studentId, assignedTeacher: teacherId }, privateFeeFields);
    if (!student) {
      return res.status(404).json({ message: 'Student not found or not assigned to this teacher.' });
    }

    // Verify enrollmentDate allows this payment month (payment month cannot be before enrollmentDate)
    const paymentPeriodEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    if (student.enrollmentDate > paymentPeriodEnd) {
      return res.status(400).json({ message: 'Cannot mark fee as paid for a month before the student\'s enrollment.' });
    }

    // An automatic status must never create a fictional cash receipt.
    if (automaticallyPaid(student, targetMonth, targetYear)) {
      return res.json({ message: 'Fee marked as paid successfully.' });
    }

    // Upsert FeePayment status
    const payment = await FeePayment.findOneAndUpdate(
      { student: studentId, month: targetMonth, year: targetYear },
      { status: 'submitted', teacher: teacherId },
      { upsert: true, new: true }
    );

    res.json({ message: 'Fee marked as paid successfully.', payment });
  } catch (error) {
    reportError(error, 'save_fee_payment_error', req);
    res.status(500).json({ message: 'Server error updating fee status.' });
  }
});

/**
 * GET /api/teacher/stats/students
 * Return list of all assigned students for selection dropdown
 */
router.get('/stats/students', async (req, res) => {
  try {
    const teacherId = req.userId;
    const students = await Student.find({ assignedTeacher: teacherId }).sort({ name: 1 });
    res.json(students);
  } catch (error) {
    reportError(error, 'fetch_stats_students_error', req);
    res.status(500).json({ message: 'Server error loading student list.' });
  }
});

/**
 * GET /api/teacher/stats/overview
 * Calculate presents, absents, percentage, and fee status for a specific student.
 * Respects Enrollment Date Filtering.
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { studentId, month, year } = req.query;
    if (!studentId) {
      return res.status(400).json({ message: 'Student ID is required.' });
    }

    const teacherId = req.userId;

    // Verify student is assigned to this teacher
    const student = await Student.findOne({ _id: studentId, assignedTeacher: teacherId }, privateFeeFields);
    if (!student) {
      return res.status(404).json({ message: 'Student not found or not assigned to you.' });
    }

    let period;
    try {
      period = attendancePeriod(month, year);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    if (period && student.enrollmentDate >= period.end) {
      return res.json({
        studentName: student.name,
        rollNumber: student.rollNumber,
        notEnrolledYet: true,
        ...summarizeAttendance([], student.enrollmentDate),
        feeStatus: 'pending'
      });
    }

    const summaries = await studentAttendanceSummaries([student], period);

    // Fetch Fee Status for the specified month/year or the current month as default
    let { month: feeMonth, year: feeYear } = currentBillingPeriod();
    if (month !== undefined && year !== undefined) {
      feeMonth = parseInt(month);
      feeYear = parseInt(year);
    }

    const feePayment = await FeePayment.findOne({
      student: student._id,
      month: feeMonth,
      year: feeYear
    });

    const feeStatus = automaticallyPaid(student, feeMonth, feeYear) ? 'submitted' : feePayment ? feePayment.status : 'pending';

    res.json({
      studentName: student.name,
      rollNumber: student.rollNumber,
      notEnrolledYet: false,
      ...summaries.get(student._id.toString()),
      feeStatus
    });
  } catch (error) {
    reportError(error, 'fetch_stats_overview_error', req);
    res.status(500).json({ message: 'Server error calculating student stats.' });
  }
});

/**
 * GET /api/teacher/stats/class
 * Fetch attendance stats and fee status for all eligible students of this class.
 * Respects Enrollment Date Filtering.
 */
router.get('/stats/class', async (req, res) => {
  try {
    const { month, year } = req.query;
    if (month === undefined || !year) {
      return res.status(400).json({ message: 'Month and year are required.' });
    }

    const teacherId = req.userId;
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    let period;
    try {
      period = attendancePeriod(month, year);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // Get all eligible students (respect enrollment date)
    const students = await Student.find({
      assignedTeacher: teacherId,
      enrollmentDate: { $lt: period.end }
    }, privateFeeFields).sort({ name: 1 });

    // Use the same student history and enrollment rules as the individual profile.
    const summaries = await studentAttendanceSummaries(students, period);

    // Fetch monthly fee statuses
    const feePayments = await FeePayment.find({
      student: { $in: students.map((student) => student._id) },
      month: targetMonth,
      year: targetYear
    });

    const feeMap = {};
    feePayments.forEach((p) => {
      feeMap[p.student.toString()] = p.status;
    });

    // Merge student info
    const classOverview = students.map((s) => ({
      _id: s._id,
      name: s.name,
      rollNumber: s.rollNumber,
      ...summaries.get(s._id.toString()),
      feeStatus: automaticallyPaid(s, targetMonth, targetYear) ? 'submitted' : feeMap[s._id.toString()] || 'pending'
    }));

    res.json(classOverview);
  } catch (error) {
    reportError(error, 'fetch_class_stats_error', req);
    res.status(500).json({ message: 'Server error generating class stats overview.' });
  }
});

module.exports = router;
