const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Counter = require('../models/Counter');
const Attendance = require('../models/Attendance');
const FeePayment = require('../models/FeePayment');
const PasswordRequest = require('../models/PasswordRequest');
const { generateRollNumber } = require('../utils/rollNumbers');
const { main } = require('../scripts/reassign-roll-numbers');
let db, teachers, backupDir;

before(async () => {
  db = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ launchTimeout: 30000 }] });
  await mongoose.connect(db.getUri('roll_number_tests'));
  await Promise.all([Student.init(), Teacher.init(), Counter.init(), Attendance.init(), FeePayment.init(), PasswordRequest.init()]);
  backupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'myacademy-roll-test-'));
}, { timeout: 120000 });
beforeEach(async () => {
  await Promise.all([Student, Teacher, Counter, Attendance, FeePayment, PasswordRequest].map((model) => model.deleteMany({})));
  teachers = await Teacher.insertMany(['A', 'B'].map((name) => ({ name, email: `${name}@example.test`, phone: '0000000000', batchName: name, password: 'fixture-hash' })));
});
after(async () => { await mongoose.disconnect(); if (db) await db.stop(); });

async function fixtures() {
  return Student.insertMany([0, 1, 2, 3].map((i) => ({ name: `Student ${i}`, rollNumber: `MA2609${[1, 3, 24, 38][i]}`,
    studentClass: '09', assignedTeacher: teachers[i < 2 ? 0 : 1]._id, fees: 5000, phone: '0000000000',
    password: 'unchanged-password-hash', enrollmentDate: new Date('2026-01-01'),
    createdAt: new Date(`2026-01-0${i + 1}`) })));
}

test('each teacher starts at 00, continues independently across classes, and remains unique under concurrent allocation', async () => {
  const first = await generateRollNumber('09', teachers[0]._id, 2026);
  const other = await generateRollNumber('09', teachers[1]._id, 2026);
  assert.equal(first, 'MA2609B01-00'); assert.equal(other, 'MA2609B02-00');
  const parallel = await Promise.all(Array.from({ length: 12 }, () => generateRollNumber('10', teachers[0]._id, 2026)));
  assert.equal(new Set(parallel).size, 12);
  assert.deepEqual(parallel.map((roll) => Number(roll.split('-').at(-1))).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(await generateRollNumber('09', teachers[1]._id, 2026), 'MA2609B02-01');
  assert.equal(await generateRollNumber('09', teachers[0]._id, 2027), 'MA2709B01-00');
});

test('dry run changes nothing; transactional reassignment closes gaps, preserves records and seeds next numbers', async () => {
  const students = await fixtures();
  await Attendance.create({ student: students[0]._id, teacher: teachers[0]._id, date: new Date('2026-10-01'), status: 'present' });
  await FeePayment.create({ student: students[0]._id, teacher: teachers[0]._id, month: 9, year: 2026, status: 'submitted' });
  const recovery = await PasswordRequest.create({ identifier: students[0].rollNumber.toLowerCase(), message: 'Reset please' });
  const before = await Student.find().select('+feeExempt +feeExemptFrom').sort({ createdAt: 1 }).lean();
  const plan = await main();
  assert.deepEqual(plan.mapping.map((row) => row.next), ['MA2609B01-00', 'MA2609B01-01', 'MA2609B02-00', 'MA2609B02-01']);
  assert.equal(await Counter.countDocuments(), 0);
  assert.equal((await Student.findById(students[0]._id)).rollNumber, students[0].rollNumber);
  const result = await main({ apply: true, backupDir });
  assert.equal(result.changed, 4); assert.ok(fs.existsSync(result.backup));
  const backup = JSON.parse(fs.readFileSync(result.backup));
  assert.equal(backup.mapping[0].old, students[0].rollNumber);
  const updated = await Student.find().select('+feeExempt +feeExemptFrom').sort({ createdAt: 1 }).lean();
  assert.deepEqual(updated.map(({ rollNumber, ...rest }) => rest), before.map(({ rollNumber, ...rest }) => rest));
  assert.equal(await Attendance.countDocuments({ student: students[0]._id }), 1);
  assert.equal(await FeePayment.countDocuments({ student: students[0]._id }), 1);
  assert.equal((await PasswordRequest.findById(recovery._id)).identifier, 'MA2609B01-00');
  assert.equal((await main({ apply: true, backupDir })).changed, 0);
  assert.equal(await generateRollNumber('10', teachers[0]._id, 2026), 'MA2610B01-02');
  assert.equal(await generateRollNumber('09', teachers[1]._id, 2026), 'MA2609B02-02');
});

test('invalid assignments abort reassignment without changing any registration numbers', async () => {
  const students = await fixtures();
  await Student.updateOne({ _id: students[0]._id }, { assignedTeacher: new mongoose.Types.ObjectId() });
  await assert.rejects(main({ apply: true, backupDir }), /assigned teacher/);
  assert.equal(await Counter.countDocuments(), 0);
  assert.deepEqual((await Student.find().sort({ createdAt: 1 })).map((s) => s.rollNumber), students.map((s) => s.rollNumber));
});

test('a failure after student writes rolls back the entire reassignment', async () => {
  const students = await fixtures();
  const original = Counter.bulkWrite;
  Counter.bulkWrite = async () => { throw new Error('Simulated counter write failure'); };
  try { await assert.rejects(main({ apply: true, backupDir }), /Simulated counter/); }
  finally { Counter.bulkWrite = original; }
  assert.deepEqual((await Student.find().sort({ createdAt: 1 })).map((s) => s.rollNumber), students.map((s) => s.rollNumber));
  assert.equal(await Counter.countDocuments(), 0);
});
