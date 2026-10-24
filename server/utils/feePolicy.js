// Private billing policy. Never serialize these fields to teacher/student responses.
const privateFeeFields = '+feeExempt +feeExemptFrom';

function currentBillingPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit',
  }).formatToParts(now);
  return { year: Number(parts.find((p) => p.type === 'year').value),
    month: Number(parts.find((p) => p.type === 'month').value) - 1 };
}

function automaticallyPaid(student, month, year) {
  if (!student.feeExempt || !student.feeExemptFrom) return false;
  const start = new Date(student.feeExemptFrom);
  return year * 12 + month >= start.getUTCFullYear() * 12 + start.getUTCMonth();
}

function setFeePolicy(student, value) {
  if (value === undefined) return;
  const enabled = value === true || value === 'true';
  if (enabled && !student.feeExempt) {
    const { year, month } = currentBillingPeriod();
    student.feeExemptFrom = new Date(Date.UTC(year, month, 1));
  }
  student.feeExempt = enabled;
  if (!enabled) student.feeExemptFrom = null;
}

function adminStudent(student) {
  return { ...student.toJSON(), feeExempt: student.feeExempt === true };
}

module.exports = { privateFeeFields, currentBillingPeriod, automaticallyPaid, setFeePolicy, adminStudent };
