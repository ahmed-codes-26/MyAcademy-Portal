const express = require('express');
const auth = require('../middleware/auth');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const FeePayment = require('../models/FeePayment');
const Note = require('../models/Note');

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
 * trend lines, study notes, and notice board for the logged-in student.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.userId;

    // Load full student document with assigned teacher details
    const student = await Student.findById(studentId).populate('assignedTeacher', 'name email batchName');
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found.' });
    }

    const { viewMode = 'all', month, year } = req.query;
    const currentYear = year ? parseInt(year, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month, 10) : new Date().getMonth() + 1;

    // Build Attendance query filter
    let attendanceFilter = { student: studentId };

    if (viewMode === 'monthly') {
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
      attendanceFilter.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    // 1. Attendance Summary Metrics
    const attendanceRecords = await Attendance.find(attendanceFilter).sort({ date: 1 });
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
    const attendancePercentage = totalDays > 0 ? Math.round((presents / totalDays) * 100) : 100;

    // 2. Fee Status & Payment History
    // Check FeePayment collection for specific month record, or fall back to student model
    const feeRecord = await FeePayment.findOne({
      student: studentId,
      month: currentMonth,
      year: currentYear,
    });

    let feeAmount = student.fees || 0;
    let feePaid = student.feesPaid || 0;
    let feeStatus = feePaid >= feeAmount && feeAmount > 0 ? 'PAID' : 'PENDING';
    let lastPaidDate = feeRecord ? feeRecord.paidAt : student.updatedAt;

    if (feeRecord) {
      feeStatus = feeRecord.status.toUpperCase();
      feeAmount = feeRecord.amount;
    }

    // 3. Attendance Trend Data (grouped by date)
    const trendMap = {};
    attendanceRecords.forEach((rec) => {
      const dateStr = new Date(rec.date).toISOString().split('T')[0];
      if (!trendMap[dateStr]) {
        trendMap[dateStr] = { date: dateStr, status: rec.status };
      }
    });

    // Transform to chart points (cumulative or daily percentage)
    let cumulativePresents = 0;
    let totalTracked = 0;
    const attendanceTrends = Object.values(trendMap).map((point) => {
      totalTracked++;
      if ((point.status || '').toLowerCase() === 'present') cumulativePresents++;
      return {
        date: point.date,
        percentage: Math.round((cumulativePresents / totalTracked) * 100),
      };
    });

    // 4. Recent Study Notes — strict class-level filtering
    const rawClass = (student.studentClass || '').trim();
    const classDigits = rawClass.replace(/\D/g, '');

    // Build an array of possible class representations to match against
    // e.g. studentClass "9" or "09" should match notes tagged "9", "09", "9th"
    const classVariants = [];
    if (classDigits) {
      classVariants.push(classDigits);                             // "9" or "09"
      classVariants.push(String(parseInt(classDigits, 10)));       // normalized without leading zero
      classVariants.push(`${parseInt(classDigits, 10)}th`);        // "9th"
    }
    if (rawClass && !classVariants.includes(rawClass)) {
      classVariants.push(rawClass);
    }

    let recentNotes = [];
    if (classVariants.length > 0) {
      recentNotes = await Note.find({ class: { $in: classVariants } })
        .populate('uploadedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(6);
    }

    // 5. Academy Notice Board Announcements
    const notices = [
      {
        id: '1',
        date: 'Oct 15, 2026',
        title: 'Mid-Term Exam Schedule Released',
        description: 'The schedule for the upcoming mid-term examinations for all classes is now available on the portal.',
      },
      {
        id: '2',
        date: 'Oct 10, 2026',
        title: 'Science Fair Project Submissions',
        description: 'Reminder to submit your Science Fair project proposals to your respective class teachers by Friday.',
      },
      {
        id: '3',
        date: 'Oct 02, 2026',
        title: 'Holiday Announcement',
        description: 'The academy will remain closed on Oct 4th due to local public holidays.',
      },
    ];

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
        percentage: attendancePercentage,
      },
      fee: {
        amount: feeAmount,
        paidAmount: feePaid,
        status: feeStatus,
        lastPaidDate,
      },
      attendanceTrends,
      recentNotes,
      notices,
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({ message: 'Server error loading student dashboard.' });
  }
});

module.exports = router;
