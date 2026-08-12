const express = require('express');
const auth = require('../middleware/auth');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const FeePayment = require('../models/FeePayment');

const router = express.Router();

// Require auth and verify user role is 'teacher'
router.use(auth);
router.use((req, res, next) => {
  if (req.userRole !== 'teacher') {
    return res.status(403).json({ message: 'Forbidden. Teacher access required.' });
  }
  next();
});

/**
 * GET /api/teacher/dashboard
 * Return summary metrics, Recharts trends, and assigned student overview.
 * Respects Enrollment Date Filtering (current month end-date limit).
 */
router.get('/dashboard', async (req, res) => {
  try {
    const teacherId = req.userId;

    // End of current calendar month
    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    // 1. Get eligible students assigned to this teacher
    const students = await Student.find({
      assignedTeacher: teacherId,
      enrollmentDate: { $lte: endOfMonth }
    }).sort({ name: 1 });

    const totalStudents = students.length;

    // 2. Calculate fee received and remaining based on current month's FeePayment records
    const currentMonth = new Date().getMonth(); // 0-11
    const currentYear = new Date().getFullYear();

    const studentIds = students.map((s) => s._id);
    const monthlyFeePayments = await FeePayment.find({
      student: { $in: studentIds },
      month: currentMonth,
      year: currentYear,
    });

    const paidStudentSet = new Set(
      monthlyFeePayments
        .filter((fp) => fp.status === 'submitted')
        .map((fp) => fp.student.toString())
    );

    let feeReceived = 0;
    let feeRemaining = 0;
    students.forEach((s) => {
      const studentFee = s.fees || 0;
      if (paidStudentSet.has(s._id.toString())) {
        feeReceived += studentFee;
      } else {
        feeRemaining += studentFee;
      }
    });

    // 3. Calculate overall attendance percentage per student
    // Aggregate overall attendance stats grouped by student for this teacher
    const overallStats = await Attendance.aggregate([
      { $match: { teacher: teacherId } },
      {
        $group: {
          _id: '$student',
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0],
            },
          },
        },
      },
    ]);

    // Map stats for easy lookup
    const statsMap = {};
    overallStats.forEach((stat) => {
      const totalDays = stat.total || 0;
      const presentDays = stat.present || 0;
      const pct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;
      statsMap[stat._id.toString()] = pct;
    });

    // Combine student info with their overall percentage
    const studentOverview = students.map((s) => ({
      _id: s._id,
      name: s.name,
      rollNumber: s.rollNumber,
      attendancePercentage: statsMap[s._id.toString()] !== undefined ? statsMap[s._id.toString()] : 100,
    }));

    // 4. Calculate monthly present percentage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlyStats = await Attendance.aggregate([
      {
        $match: {
          teacher: teacherId,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0],
            },
          },
        },
      },
    ]);

    let monthlyPresentPct = 100;
    if (monthlyStats.length > 0 && monthlyStats[0].total > 0) {
      monthlyPresentPct = Math.round((monthlyStats[0].present / monthlyStats[0].total) * 100);
    }

    // 5. Monthly attendance trends (grouped by date)
    const dailyTrends = await Attendance.aggregate([
      {
        $match: {
          teacher: teacherId,
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const attendanceTrends = dailyTrends.map((trend) => ({
      date: trend._id,
      percentage: trend.total > 0 ? Math.round((trend.present / trend.total) * 100) : 100,
    }));

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
    console.error('Teacher dashboard error:', error);
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
    console.error('Fetch attendance error:', error);
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
    console.error('Delete attendance error:', error);
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
    if (!date || !records || !Array.isArray(records)) {
      return res.status(400).json({ message: 'Date and records array are required.' });
    }

    const teacherId = req.userId;
    const targetDate = new Date(date + 'T00:00:00.000Z');

    // 1. Check if this is a new creation vs an update/edit (No-Edit rule)
    const existingRecord = await Attendance.findOne({ teacher: teacherId, date: targetDate });
    const isNewCreation = !existingRecord;

    // 2. Check if the submitted attendance date is exactly Today (Current Date check)
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = date === todayStr;

    console.log('--- Attendance Submit Trigger Debug ---');
    console.log(`Submitting Date: ${date}`);
    console.log(`Server Today Date: ${todayStr}`);
    console.log(`Is Today: ${isToday}`);
    console.log(`Is New Creation (Not an Edit): ${isNewCreation}`);
    console.log('-----------------------------------------');

    // Create bulk operations to upsert daily records
    const bulkOps = records.map((rec) => ({
      updateOne: {
        filter: { student: rec.studentId, date: targetDate },
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

      console.log(`Absent student IDs isolated: ${JSON.stringify(absentStudentIds)}`);

      if (absentStudentIds.length > 0) {
        // Retrieve teacher's active WhatsApp socket (gracefully handle if missing)
        try {
          const { getWhatsAppSocket } = require('../utils/whatsappManager');
          const sock = getWhatsAppSocket(teacherId);
          console.log(`Teacher WhatsApp socket found: ${!!sock}`);

          if (sock) {
            // Retrieve student details (names & phone numbers)
            const students = await Student.find({ _id: { $in: absentStudentIds } });
            console.log(`Fetched absent student details: ${JSON.stringify(students.map(s => ({ name: s.name, phone: s.phone })))}`);

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
                    console.log(`Attempting to send WhatsApp message to JID: ${jid} for student: ${student.name}`);
                    await sock.sendMessage(jid, {
                      text: `Notice from MyAcademy: ${student.name} has been marked absent today (${date}). Please contact the administration if you have any questions.`
                    });
                    console.log(`WhatsApp absence alert sent to ${student.name} (${cleanPhone})`);
                  } catch (err) {
                    console.error(`Failed to send WhatsApp alert to ${student.name}:`, err.message);
                  }
                } else {
                  console.warn(`No phone number recorded for student: ${student.name}`);
                }
              }
            })().catch((err) => console.error('Background WhatsApp alert loop error:', err));
          } else {
            console.log(`Teacher ${teacherId} does not have an active WhatsApp session linked. Skipping absence alerts.`);
          }
        } catch (helperErr) {
          console.error('Graceful WhatsApp session helper bypass error:', helperErr.message);
        }
      } else {
        console.log('No students marked Absent in this submission. Skipping alerts.');
      }
    }

    res.status(200).json({ message: 'Attendance saved successfully.' });
  } catch (error) {
    console.error('Save attendance error:', error);
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
    console.error('Fetch attendance dates error:', error);
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
    }).sort({ name: 1 });

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
      status: paymentMap[s._id.toString()] || 'pending'
    }));

    res.json(studentList);
  } catch (error) {
    console.error('Fetch fees error:', error);
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
    if (!studentId || month === undefined || !year) {
      return res.status(400).json({ message: 'Student ID, month, and year are required.' });
    }

    const teacherId = req.userId;
    const targetMonth = parseInt(month);
    const targetYear = parseInt(year);

    // Verify student exists and is assigned to this teacher
    const student = await Student.findOne({ _id: studentId, assignedTeacher: teacherId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found or not assigned to this teacher.' });
    }

    // Verify enrollmentDate allows this payment month (payment month cannot be before enrollmentDate)
    const paymentPeriodEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    if (student.enrollmentDate > paymentPeriodEnd) {
      return res.status(400).json({ message: 'Cannot mark fee as paid for a month before the student\'s enrollment.' });
    }

    // Upsert FeePayment status
    const payment = await FeePayment.findOneAndUpdate(
      { student: studentId, month: targetMonth, year: targetYear },
      { status: 'submitted', teacher: teacherId },
      { upsert: true, new: true }
    );

    res.json({ message: 'Fee marked as paid successfully.', payment });
  } catch (error) {
    console.error('Save fee payment error:', error);
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
    console.error('Fetch stats students error:', error);
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
    const student = await Student.findOne({ _id: studentId, assignedTeacher: teacherId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found or not assigned to you.' });
    }

    let matchQuery = { student: student._id };

    // Apply month/year filters if provided
    if (month !== undefined && year !== undefined) {
      const targetMonth = parseInt(month);
      const targetYear = parseInt(year);
      const startOfPeriod = new Date(targetYear, targetMonth, 1);
      const endOfPeriod = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

      // Student must be enrolled during or before the selected period
      if (student.enrollmentDate > endOfPeriod) {
        return res.json({
          studentName: student.name,
          rollNumber: student.rollNumber,
          notEnrolledYet: true,
          attendancePercentage: 0,
          totalPresents: 0,
          totalAbsents: 0,
          feeStatus: 'pending'
        });
      }

      matchQuery.date = { $gte: startOfPeriod, $lte: endOfPeriod };
    } else {
      // All time overview: only query dates on or after student's enrollmentDate
      matchQuery.date = { $gte: student.enrollmentDate };
    }

    // Aggregate stats
    const stats = await Attendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0],
            },
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ['$status', 'absent'] }, 1, 0],
            },
          },
        },
      },
    ]);

    const totalDays = stats.length > 0 ? stats[0].total : 0;
    const presents = stats.length > 0 ? stats[0].present : 0;
    const absents = stats.length > 0 ? stats[0].absent : 0;
    const percentage = totalDays > 0 ? Math.round((presents / totalDays) * 100) : 100;

    // Fetch Fee Status for the specified month/year or the current month as default
    let feeMonth = new Date().getMonth();
    let feeYear = new Date().getFullYear();
    if (month !== undefined && year !== undefined) {
      feeMonth = parseInt(month);
      feeYear = parseInt(year);
    }

    const feePayment = await FeePayment.findOne({
      student: student._id,
      month: feeMonth,
      year: feeYear
    });

    const feeStatus = feePayment ? feePayment.status : 'pending';

    res.json({
      studentName: student.name,
      rollNumber: student.rollNumber,
      notEnrolledYet: false,
      attendancePercentage: percentage,
      totalPresents: presents,
      totalAbsents: absents,
      feeStatus
    });
  } catch (error) {
    console.error('Fetch stats overview error:', error);
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

    const startOfPeriod = new Date(targetYear, targetMonth, 1);
    const endOfPeriod = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    // Get all eligible students (respect enrollment date)
    const students = await Student.find({
      assignedTeacher: teacherId,
      enrollmentDate: { $lte: endOfPeriod }
    }).sort({ name: 1 });

    // Aggregate monthly attendance stats for these students
    const attendanceStats = await Attendance.aggregate([
      {
        $match: {
          teacher: teacherId,
          date: { $gte: startOfPeriod, $lte: endOfPeriod }
        }
      },
      {
        $group: {
          _id: '$student',
          total: { $sum: 1 },
          present: {
            $sum: {
              $cond: [{ $eq: ['$status', 'present'] }, 1, 0]
            }
          }
        }
      }
    ]);

    const statsMap = {};
    attendanceStats.forEach((stat) => {
      const pct = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 100;
      statsMap[stat._id.toString()] = pct;
    });

    // Fetch monthly fee statuses
    const feePayments = await FeePayment.find({
      teacher: teacherId,
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
      attendancePercentage: statsMap[s._id.toString()] !== undefined ? statsMap[s._id.toString()] : 100,
      feeStatus: feeMap[s._id.toString()] || 'pending'
    }));

    res.json(classOverview);
  } catch (error) {
    console.error('Fetch class stats error:', error);
    res.status(500).json({ message: 'Server error generating class stats overview.' });
  }
});

module.exports = router;
