const { reportError } = require('../utils/logger');
const express = require('express');
const auth = require('../middleware/auth');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const FeePayment = require('../models/FeePayment');
const { privateFeeFields, automaticallyPaid, currentBillingPeriod } = require('../utils/feePolicy');
const Note = require('../models/Note');
const { attendancePercentage } = require('../utils/attendanceStats');
const { integer } = require('../middleware/validation');
const { classVariants } = require('../utils/noteAccess');
const studentChartWindow = require('../utils/studentChartWindow');

const router = express.Router();

// Require auth & verify student role
router.use(auth);
router.use((req, res, next) => {
  if (req.userRole !== 'student') {
    return res.status(403).json({ message: 'Forbidden. Student access required.' });
  }
  next();
});

/**
 * GET /api/student/dashboard
 * Return aggregated dashboard analytics, attendance donut stats, fee status,
 * trend lines and class study notes for the logged-in student.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.userId;

    // Load full student document with assigned teacher details
    const student = await Student.findById(studentId, privateFeeFields).populate('assignedTeacher', 'name email batchName');
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const { viewMode = 'all', month, year } = req.query;
    if (!['all', 'monthly'].includes(viewMode) ||
        (month !== undefined && !integer(month, 1, 12)) ||
        (year !== undefined && !integer(year, 1000, 9999))) {
      return res.status(400).json({ message: 'Invalid dashboard period.' });
    }
    const billingPeriod = currentBillingPeriod();
    const currentYear = year ? parseInt(year, 10) : billingPeriod.year;
    const currentMonth = month ? parseInt(month, 10) : billingPeriod.month + 1;

    // Build Attendance query filter
    const enrollmentStart = new Date(student.enrollmentDate);
    enrollmentStart.setUTCHours(0, 0, 0, 0);
    let attendanceFilter = { student: studentId, date: { $gte: enrollmentStart } };

    if (viewMode === 'monthly') {
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
      attendanceFilter.date = { $gte: enrollmentStart > startOfMonth ? enrollmentStart : startOfMonth, $lte: endOfMonth };
    }

    // 1. Attendance Summary Metrics & Streak Calculation
    const attendanceRecords = await Attendance.find(attendanceFilter).select('date status').sort({ date: 1 }).lean();
    let presents = 0;
    let absents = 0;
    let leaves = 0;

    attendanceRecords.forEach((rec) => {
      const statusLower = (rec.status || '').toLowerCase();
      if (statusLower === 'present') presents++;
      else if (statusLower === 'absent') absents++;
      else if (statusLower === 'leave') leaves++;
    });

    const totalDays = attendanceRecords.length;
    const percentage = attendancePercentage(presents, absents);

    // Calculate consecutive presence streak (most recent first)
    const allRecordsForStreak = viewMode === 'all' ? [...attendanceRecords].reverse() :
      await Attendance.find({ student: studentId, date: { $gte: enrollmentStart } }).select('status').sort({ date: -1 }).lean();
    let streak = 0;
    for (const rec of allRecordsForStreak) {
      const statusLower = (rec.status || '').toLowerCase();
      if (statusLower === 'present') {
        streak++;
      } else if (statusLower === 'absent') {
        break;
      }
    }

    // 2. Fee Status & Payment History
    // Check FeePayment collection for specific month record, or fall back to student model
    const feeRecord = await FeePayment.findOne({
      student: studentId,
      month: currentMonth - 1, // Dashboard months are 1–12; FeePayment stores 0–11.
      year: currentYear,
    });

    const feeAmount = student.fees || 0;
    let feePaid = student.feesPaid || 0;
    let feeStatus = feePaid >= feeAmount && feeAmount > 0 ? 'PAID' : 'PENDING';
    let lastPaidDate = student.updatedAt;

    if (feeRecord) {
      const paid = feeRecord.status === 'submitted';
      feeStatus = paid ? 'PAID' : 'PENDING';
      feePaid = paid ? feeAmount : 0;
      lastPaidDate = paid ? feeRecord.updatedAt : null;
    }

    if (automaticallyPaid(student, currentMonth - 1, currentYear)) {
      feeStatus = 'PAID';
      feePaid = feeAmount;
      lastPaidDate = feeRecord?.status === 'submitted' ? feeRecord.updatedAt : null;
    }

    // 3. Attendance Trend Data (grouped by date)
    const trendMap = {};
    attendanceRecords.forEach((rec) => {
      const dateStr = new Date(rec.date).toISOString().split('T')[0];
      if (!trendMap[dateStr]) {
        trendMap[dateStr] = { date: dateStr, status: rec.status };
      }
    });

    // Preserve the cumulative rate, but send only the fifteen-day display window.
    let cumulativePresents = 0;
    let cumulativeAbsents = 0;
    const chartWindow = studentChartWindow(viewMode, currentMonth, currentYear);
    const attendanceTrends = Object.values(trendMap).map((point) => {
      if ((point.status || '').toLowerCase() === 'present') cumulativePresents++;
      if ((point.status || '').toLowerCase() === 'absent') cumulativeAbsents++;
      return {
        date: point.date,
        percentage: attendancePercentage(cumulativePresents, cumulativeAbsents),
      };
    }).filter((point) => chartWindow && point.date >= chartWindow.start && point.date <= chartWindow.end);

    // 4. Complete study library — strict class-level filtering, grouped by subject in the UI.
    const studentClasses = classVariants(student.studentClass);

    let recentNotes = [];
    if (studentClasses.length > 0) {
      recentNotes = await Note.find({ class: { $in: studentClasses } })
        .select('-fileUrl -publicId')
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 }).lean();
    }

    res.json({
      student: {
        _id: student._id,
        name: student.name,
        rollNumber: student.rollNumber,
        studentClass: student.studentClass,
        profilePicture: student.profilePicture,
        phone: student.phone,
        assignedTeacher: student.assignedTeacher
          ? {
              _id: student.assignedTeacher._id,
              name: student.assignedTeacher.name,
              email: student.assignedTeacher.email,
              batchName: student.assignedTeacher.batchName,
            }
          : null,
      },
      attendance: {
        presents,
        absents,
        leaves,
        totalDays,
        percentage,
        streak,
      },
      fee: {
        amount: feeAmount,
        paidAmount: feePaid,
        status: feeStatus,
        lastPaidDate,
      },
      attendanceTrends,
      attendanceTrendWindow: chartWindow,
      recentNotes,
    });
  } catch (error) {
    reportError(error, 'student_dashboard_error', req);
    res.status(500).json({ message: 'Server error loading student dashboard.' });
  }
});

module.exports = router;
