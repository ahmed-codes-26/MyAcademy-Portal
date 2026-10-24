const DAY = 86400000;

// Attendance dates are stored at UTC midnight; "today" follows the academy's timezone.
function studentChartWindow(viewMode, month, year, now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi',
    year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  let end = new Date(`${today}T00:00:00.000Z`);
  let periodStart = null;
  if (viewMode === 'monthly') {
    periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    if (periodEnd < end) end = periodEnd;
  }
  let start = new Date(end.getTime() - 14 * DAY);
  if (periodStart && start < periodStart) start = periodStart;
  if (start > end) return null;
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

module.exports = studentChartWindow;
