const { test } = require('node:test');
const assert = require('node:assert/strict');
const windowFor = require('../utils/studentChartWindow');

test('student chart includes today and exactly fourteen preceding calendar days in academy timezone', () => {
  assert.deepEqual(windowFor('all', 10, 2026, new Date('2026-10-24T12:00:00Z')),
    { start: '2026-10-10', end: '2026-10-24' });
  assert.deepEqual(windowFor('all', 10, 2026, new Date('2026-10-24T20:00:00Z')),
    { start: '2026-10-11', end: '2026-10-25' });
});

test('monthly chart caps at today for the current month and does not cross into a previous month', () => {
  assert.deepEqual(windowFor('monthly', 10, 2026, new Date('2026-10-04T08:00:00Z')),
    { start: '2026-10-01', end: '2026-10-04' });
});

test('historical chart uses final fifteen days of selected month, including leap years', () => {
  assert.deepEqual(windowFor('monthly', 2, 2024, new Date('2026-10-24T08:00:00Z')),
    { start: '2024-02-15', end: '2024-02-29' });
  assert.deepEqual(windowFor('monthly', 12, 2025, new Date('2026-01-02T08:00:00Z')),
    { start: '2025-12-17', end: '2025-12-31' });
});

test('future selected months have no chart window', () => {
  assert.equal(windowFor('monthly', 11, 2026, new Date('2026-10-24T08:00:00Z')), null);
});
