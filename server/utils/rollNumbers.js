const Counter = require('../models/Counter');

const batchKey = (teacher) => `batch_code_${teacher}`;
const enrollmentKey = (teacher, year) => `batch_enrollment_${teacher}_${year}`;

async function batchCode(teacher, session = null) {
  const existing = await Counter.findById(batchKey(teacher)).session(session);
  if (existing) return existing.seq;
  const allocated = await Counter.findOneAndUpdate({ _id: 'batch_codes' }, { $inc: { seq: 1 } },
    { upsert: true, new: true, session });
  try {
    const batch = await Counter.findOneAndUpdate({ _id: batchKey(teacher) },
      { $setOnInsert: { seq: allocated.seq } }, { upsert: true, new: true, session });
    return batch.seq;
  } catch (error) {
    if (error.code !== 11000 || session) throw error;
    return (await Counter.findById(batchKey(teacher))).seq;
  }
}

function formatRollNumber(studentClass, year, code, sequence) {
  return `MA${String(year % 100).padStart(2, '0')}${String(studentClass).padStart(2, '0')}B${String(code).padStart(2, '0')}-${String(sequence).padStart(2, '0')}`;
}

async function generateRollNumber(studentClass, teacher, year = new Date().getFullYear()) {
  const code = await batchCode(teacher);
  // The stored value is the next available number, allowing each batch to start at 00.
  const previous = await Counter.findOneAndUpdate({ _id: enrollmentKey(teacher, year) },
    { $inc: { seq: 1 } }, { upsert: true, new: false });
  return formatRollNumber(studentClass, year, code, previous?.seq || 0);
}

module.exports = { batchCode, enrollmentKey, formatRollNumber, generateRollNumber };
