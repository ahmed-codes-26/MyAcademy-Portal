const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const FeePayment = require('../models/FeePayment');
const router = require('../routes/teacher');
const { attendancePeriod, summarizeAttendance } = require('../utils/attendanceStats');

afterEach(() => mock.restoreAll());

const record = (date, status, student = 'alice') => ({ student, date: new Date(`${date}T00:00:00Z`), status });

test('equal presents and absents give equal rates regardless of leave count', () => {
  const records = [record('2026-10-01', 'present'), record('2026-10-02', 'present'), record('2026-10-03', 'absent')];
  const withoutLeave = summarizeAttendance(records, '2026-10-01');
  const withLeave = summarizeAttendance([...records, record('2026-10-04', 'leave'), record('2026-10-05', 'leave')], '2026-10-01');
  assert.equal(withoutLeave.attendancePercentage, 67);
  assert.equal(withLeave.attendancePercentage, 67);
  assert.equal(withLeave.countedDays, 3);
  assert.equal(withLeave.totalLeaves, 2);
  assert.deepEqual(withLeave.absentDates, ['2026-10-03']);
  assert.deepEqual(withLeave.leaveDates, ['2026-10-05', '2026-10-04']);
});

test('empty and leave-only periods have no counted days and never default to 100%', () => {
  for (const records of [[], [record('2026-10-01', 'leave')]]) {
    const result = summarizeAttendance(records, '2026-10-01');
    assert.equal(result.countedDays, 0);
    assert.equal(result.attendancePercentage, 0);
  }
  assert.equal(summarizeAttendance([record('2026-10-01', 'present')], '2026-10-01').attendancePercentage, 100);
  assert.equal(summarizeAttendance([record('2026-10-01', 'absent')], '2026-10-01').attendancePercentage, 0);
});

test('enrollment day is included and earlier records are excluded', () => {
  const result = summarizeAttendance([
    record('2026-09-30', 'absent'), record('2026-10-01', 'present'), record('2026-10-02', 'leave'),
  ], '2026-10-01T12:30:00Z');
  assert.equal(result.totalPresents, 1);
  assert.deepEqual(result.absentDates, []);
  assert.deepEqual(result.leaveDates, ['2026-10-02']);
});

test('month boundaries use UTC, including leap years and year rollover', () => {
  assert.deepEqual(attendancePeriod('1', '2028'), {
    start: new Date('2028-02-01T00:00:00Z'), end: new Date('2028-03-01T00:00:00Z'),
  });
  assert.equal(attendancePeriod('11', '2026').end.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(attendancePeriod(), null);
  for (const [month, year] of [['12', '2026'], ['-1', '2026'], ['1x', '2026'], ['1', undefined], ['', '2026']]) {
    assert.throws(() => attendancePeriod(month, year), RangeError);
  }
});

// Exercise the actual route handlers with an in-memory model boundary; no live DB is used.
async function request(path, query) {
  const route = router.stack.find((layer) => layer.route?.path === path).route;
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await route.stack[0].handle({ query, userId: 'teacher-1' }, response);
  return response;
}

function mockRecords() {
  const students = [
    { _id: 'alice', name: 'Alice', rollNumber: 'A1', assignedTeacher: 'teacher-1', enrollmentDate: new Date('2026-10-01') },
    { _id: 'bob', name: 'Bob', rollNumber: 'B1', assignedTeacher: 'teacher-1', enrollmentDate: new Date('2026-10-01') },
    { _id: 'future', name: 'Future', assignedTeacher: 'teacher-1', enrollmentDate: new Date('2026-11-01') },
    { _id: 'other', name: 'Other class', assignedTeacher: 'teacher-2', enrollmentDate: new Date('2026-10-01') },
  ];
  const records = [
    record('2026-09-30', 'absent'), record('2026-10-01', 'present'), record('2026-10-02', 'present'),
    record('2026-10-03', 'absent'), record('2026-10-31', 'leave'), record('2026-11-01', 'absent'),
    record('2026-10-01', 'absent', 'other'),
  ];
  mock.method(Student, 'findOne', async (query) => students.find((s) => s._id === query._id && s.assignedTeacher === query.assignedTeacher));
  mock.method(Student, 'find', (query) => ({ sort: async () => students.filter((s) =>
    s.assignedTeacher === query.assignedTeacher && s.enrollmentDate < query.enrollmentDate.$lt
  ) }));
  mock.method(Attendance, 'find', (query) => ({ select: () => ({ lean: async () => records.filter((r) =>
    query.student.$in.includes(r.student) && (!query.date || (r.date >= query.date.$gte && r.date < query.date.$lt))
  ) }) }));
  mock.method(FeePayment, 'findOne', async () => null);
  mock.method(FeePayment, 'find', async () => []);
}

test('profile and class return matching rates, counts and dates for the selected month', async () => {
  mockRecords();
  const profile = await request('/stats/overview', { studentId: 'alice', month: '9', year: '2026' });
  const classroom = await request('/stats/class', { month: '9', year: '2026' });
  assert.equal(profile.statusCode, 200);
  assert.equal(classroom.statusCode, 200);
  assert.equal(profile.body.attendancePercentage, 67);
  assert.deepEqual(profile.body.absentDates, ['2026-10-03']);
  assert.deepEqual(profile.body.leaveDates, ['2026-10-31']);
  assert.equal(classroom.body.length, 2);
  for (const key of ['attendancePercentage', 'totalPresents', 'totalAbsents', 'totalLeaves', 'countedDays', 'absentDates', 'leaveDates']) {
    assert.deepEqual(classroom.body[0][key], profile.body[key]);
  }
  assert.equal(classroom.body[1].countedDays, 0);
  assert.equal(classroom.body[1].attendancePercentage, 0);
});

test('all-time history includes later absences but still excludes pre-enrollment records', async () => {
  mockRecords();
  const result = await request('/stats/overview', { studentId: 'alice' });
  assert.equal(result.body.attendancePercentage, 50);
  assert.deepEqual(result.body.absentDates, ['2026-11-01', '2026-10-03']);
});

test('stats reject unassigned students and invalid periods; future enrollment returns empty history', async () => {
  mockRecords();
  assert.equal((await request('/stats/overview', { studentId: 'other' })).statusCode, 404);
  assert.equal((await request('/stats/overview', { studentId: 'alice', month: '12', year: '2026' })).statusCode, 400);
  assert.equal((await request('/stats/class', { month: '12', year: '2026' })).statusCode, 400);
  const future = await request('/stats/overview', { studentId: 'future', month: '9', year: '2026' });
  assert.equal(future.body.notEnrolledYet, true);
  assert.deepEqual(future.body.absentDates, []);
  assert.deepEqual(future.body.leaveDates, []);
});
