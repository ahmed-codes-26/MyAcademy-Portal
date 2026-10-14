const Attendance = require('../models/Attendance');

// Approved leave and unmarked days do not affect the attendance rate.
function attendancePercentage(presents, absents) {
  const countedDays = presents + absents;
  return countedDays > 0 ? Math.round((presents / countedDays) * 100) : 0;
}

function attendancePeriod(month, year) {
  if (month === undefined && year === undefined) return null;
  const m = Number(month);
  const y = Number(year);
  if (month === undefined || year === undefined || String(month).trim() === '' ||
      String(year).trim() === '' || !Number.isInteger(m) || m < 0 || m > 11 ||
      !Number.isInteger(y) || y < 1000 || y > 9999) {
    throw new RangeError('A valid month (0–11) and year are required.');
  }
  // Attendance is saved at UTC midnight, so period boundaries must also use UTC.
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 1)) };
}

function summarizeAttendance(records, enrollmentDate) {
  const enrolled = new Date(enrollmentDate);
  enrolled.setUTCHours(0, 0, 0, 0);
  let totalPresents = 0;
  const absentDates = [];
  const leaveDates = [];
  for (const record of records) {
    const date = new Date(record.date);
    if (date < enrolled) continue;
    if (record.status === 'present') totalPresents++;
    else if (record.status === 'absent') absentDates.push(date.toISOString().slice(0, 10));
    else if (record.status === 'leave') leaveDates.push(date.toISOString().slice(0, 10));
  }
  const totalAbsents = absentDates.length;
  const totalLeaves = leaveDates.length;
  return {
    totalPresents,
    totalAbsents,
    totalLeaves,
    totalDays: totalPresents + totalAbsents + totalLeaves,
    countedDays: totalPresents + totalAbsents,
    attendancePercentage: attendancePercentage(totalPresents, totalAbsents),
    absentDates: absentDates.sort().reverse(),
    leaveDates: leaveDates.sort().reverse(),
  };
}

async function studentAttendanceSummaries(students, period) {
  const query = { student: { $in: students.map((student) => student._id) } };
  if (period) query.date = { $gte: period.start, $lt: period.end };
  const records = students.length
    ? await Attendance.find(query).select('student date status').lean()
    : [];
  const byStudent = new Map();
  for (const record of records) {
    const id = record.student.toString();
    if (!byStudent.has(id)) byStudent.set(id, []);
    byStudent.get(id).push(record);
  }
  return new Map(students.map((student) => [
    student._id.toString(),
    summarizeAttendance(byStudent.get(student._id.toString()) || [], student.enrollmentDate),
  ]));
}

module.exports = { attendancePercentage, attendancePeriod, summarizeAttendance, studentAttendanceSummaries };
