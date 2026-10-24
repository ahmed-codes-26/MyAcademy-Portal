const path = require('node:path');
const fs = require('node:fs');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Counter = require('../models/Counter');
const PasswordRequest = require('../models/PasswordRequest');
const { enrollmentKey, formatRollNumber } = require('../utils/rollNumbers');

async function planReassignment(session = null) {
  const students = await Student.find().select('_id name assignedTeacher studentClass rollNumber createdAt')
    .sort({ createdAt: 1, _id: 1 }).session(session).lean();
  const teachers = await Teacher.find().select('_id name batchName').sort({ createdAt: 1, _id: 1 }).session(session).lean();
  const counters = await Counter.find().session(session).lean();
  const byKey = new Map(counters.map((c) => [c._id, c.seq]));
  let lastCode = Math.max(byKey.get('batch_codes') || 0,
    ...counters.filter((counter) => counter._id.startsWith('batch_code_')).map((counter) => counter.seq));
  const codes = new Map();
  for (const teacher of teachers) {
    const key = `batch_code_${teacher._id}`;
    const code = byKey.get(key) || ++lastCode;
    codes.set(String(teacher._id), code);
  }
  const nextNumbers = new Map();
  const mapping = students.map((student) => {
    const teacher = String(student.assignedTeacher);
    if (!codes.has(teacher)) throw new Error('A student has no existing assigned teacher; correct assignments before renumbering.');
    const match = /^MA(\d{2})\d{2}/.exec(student.rollNumber);
    if (!match) throw new Error('An existing registration number has an unrecognized session. Nothing was changed.');
    const year = 2000 + Number(match[1]);
    const key = enrollmentKey(teacher, year);
    const number = nextNumbers.get(key) || 0;
    nextNumbers.set(key, number + 1);
    return { id: String(student._id), name: student.name, teacher,
      old: student.rollNumber, next: formatRollNumber(student.studentClass, year, codes.get(teacher), number) };
  });
  if (new Set(mapping.map((row) => row.next)).size !== mapping.length) throw new Error('Registration number collision detected.');
  const byOldNumber = new Map(mapping.map((row) => [row.old, row.next]));
  const requests = await PasswordRequest.find().select('_id identifier').session(session).lean();
  const requestMapping = requests.filter((row) => byOldNumber.has(row.identifier.toUpperCase()))
    .map((row) => ({ id: String(row._id), old: row.identifier, next: byOldNumber.get(row.identifier.toUpperCase()) }));
  return { mapping, requestMapping, counters: [
    { _id: 'batch_codes', seq: lastCode },
    ...Array.from(codes, ([teacher, seq]) => ({ _id: `batch_code_${teacher}`, seq })),
    ...Array.from(nextNumbers, ([_id, seq]) => ({ _id, seq })),
  ], batches: teachers.map((teacher) => ({ teacher: String(teacher._id), name: teacher.name, batch: teacher.batchName,
    code: codes.get(String(teacher._id)), students: mapping.filter((row) => row.teacher === String(teacher._id)).length })) };
}

async function main({ apply = false, backupDir = path.join(__dirname, '../backups/roll-numbers') } = {}) {
  if (!apply) return { apply: false, ...await planReassignment() };
  let result;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const plan = await planReassignment(session);
      const changed = plan.mapping.filter((row) => row.old !== row.next);
      fs.mkdirSync(backupDir, { recursive: true });
      const backup = path.join(backupDir, `roll-numbers-${Date.now()}-${require('node:crypto').randomUUID()}.json`);
      // Written before any change. A transaction retry may leave an extra, harmless plan backup.
      fs.writeFileSync(backup, JSON.stringify({ createdAt: new Date().toISOString(), ...plan }, null, 2), { flag: 'wx' });
      if (changed.length) {
        // Temporary values stay inside the transaction; no user can observe partial renumbering.
        await Student.bulkWrite(changed.map((row) => ({ updateOne: { filter: { _id: row.id, rollNumber: row.old },
          update: { $set: { rollNumber: `RENUMBER-${row.id}` } }, timestamps: false } })), { session });
        await Student.bulkWrite(changed.map((row) => ({ updateOne: { filter: { _id: row.id },
          update: { $set: { rollNumber: row.next } }, timestamps: false } })), { session });
      }
      await Counter.bulkWrite(plan.counters.map((counter) => ({ updateOne: { filter: { _id: counter._id },
        update: { $set: { seq: counter.seq } }, upsert: true } })), { session });
      if (plan.requestMapping.length) await PasswordRequest.bulkWrite(plan.requestMapping.map((row) => ({ updateOne: {
        filter: { _id: row.id, identifier: row.old }, update: { $set: { identifier: row.next } }, timestamps: false,
      } })), { session });
      result = { apply: true, changed: changed.length, total: plan.mapping.length, batches: plan.batches, backup };
    });
    return result;
  } finally { await session.endSession(); }
}

if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => main({ apply: process.argv.includes('--apply') }))
    .then((result) => console.log(JSON.stringify(result.apply ? result : {
      apply: false, total: result.mapping.length, changes: result.mapping.filter((row) => row.old !== row.next).length,
      batches: result.batches,
    }, null, 2)))
    .catch((error) => { console.error(`Registration reassignment failed (${error.code || error.name}). No transaction changes were committed.`); process.exitCode = 1; })
    .finally(() => mongoose.disconnect());
}
module.exports = { main, planReassignment };
