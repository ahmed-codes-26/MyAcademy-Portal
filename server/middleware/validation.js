const objectId = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const integer = (value, min, max) => (typeof value === 'string' || typeof value === 'number') &&
  /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
const dateOnly = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

function unsafeKeys(value, depth = 0) {
  if (depth > 12) return true;
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some((key) => key.startsWith('$') || key.includes('.') ||
    ['__proto__', 'prototype', 'constructor'].includes(key) || unsafeKeys(value[key], depth + 1));
}

function rejectQueryOperators(req, res, next) {
  if (unsafeKeys(req.query) || unsafeKeys(req.body)) {
    return res.status(400).json({ message: 'Invalid request fields.' });
  }
  next();
}

function validateId(req, res, next, id) {
  if (!objectId(id)) return res.status(400).json({ message: 'Invalid record ID.' });
  next();
}

function bodyFields(rules) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || unsafeKeys(req.body)) {
      return res.status(400).json({ message: 'Invalid request body.' });
    }
    for (const [field, value] of Object.entries(req.body)) {
      if (!Object.hasOwn(rules, field) || !rules[field](value)) {
        return res.status(400).json({ message: `Invalid ${field}.` });
      }
    }
    next();
  };
}

const text = (max) => (value) => typeof value === 'string' && value.length <= max;
const password = (value) => typeof value === 'string' && value.length >= 6 && Buffer.byteLength(value, 'utf8') <= 72;
const money = (value) => ['string', 'number'].includes(typeof value) && String(value).trim() !== '' &&
  Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1e9;
const enrollment = (value) => typeof value === 'string' && value.length <= 40 &&
  Number.isFinite(Date.parse(value)) && dateOnly(value.slice(0, 10));
const studentFields = { name: text(120), studentClass: (v) => typeof v === 'string' && /^\d{1,2}$/.test(v),
  assignedTeacher: objectId, fees: money, feesPaid: money, phone: text(40), password, enrollmentDate: enrollment,
  feeExempt: (value) => [true, false, 'true', 'false'].includes(value) };
const teacherFields = { name: text(120), email: text(254), phone: text(40), batchName: text(120), password };
const profileFields = { name: text(120), email: text(254), phone: text(40), password };

function teacherQuery(req, res, next) {
  const { date, studentId, month, year } = req.query;
  if ((date !== undefined && !dateOnly(date)) || (studentId !== undefined && !objectId(studentId)) ||
      (month !== undefined && !integer(month, 0, 11)) || (year !== undefined && !integer(year, 1000, 9999))) {
    return res.status(400).json({ message: 'Invalid date, student ID, month or year.' });
  }
  next();
}

module.exports = { objectId, integer, dateOnly, rejectQueryOperators, validateId, bodyFields,
  text, password, studentFields, teacherFields, profileFields, teacherQuery };
