const { test, before, beforeEach, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Writable } = require('node:stream');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const security = require('../config/security');
const { issueToken } = require('../utils/tokens');
const { encryptCredential, decryptCredential } = require('../utils/credentialEncryption');
const cloudinary = require('../config/cloudinary');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const FeePayment = require('../models/FeePayment');
const Note = require('../models/Note');
const TestNote = require('../models/TestNote');
const { currentBillingPeriod } = require('../utils/feePolicy');
const PasswordRequest = require('../models/PasswordRequest');
const WhatsAppSession = require('../models/WhatsAppSession');
const Counter = require('../models/Counter');
require('../utils/logger').logger.level = 'silent';

// Network provider boundaries are stubbed; Express, JWT, Mongoose, bcrypt, file
// parsing and an actual disposable MongoDB process remain real.
const waPath = require.resolve('../utils/whatsappManager');
require.cache[waPath] = { id: waPath, filename: waPath, loaded: true, exports: {
  getSessionStatus: () => ({ status: 'disconnected', qrCode: null, phone: null }),
  disconnectSession: async () => {}, getWhatsAppSocket: () => null,
} };
const createApp = require('../app');
const { useMongoDBAuthState } = require('../utils/whatsappAuthHelper');

let database, server, productionServer, base, productionBase, users, tokens, hash;
let uploads = [], deletions = [];
const ids = Object.fromEntries(['admin', 'teacher', 'otherTeacher', 'student', 'otherStudent', 'futureStudent']
  .map((name, i) => [name, new mongoose.Types.ObjectId((i + 1).toString(16).padStart(24, '0'))]));

before(async () => {
  database = await MongoMemoryServer.create({ instance: { dbName: 'myacademy_security_tests', launchTimeout: 30000 } });
  await mongoose.connect(database.getUri());
  await Promise.all([Admin.init(), Student.init(), Teacher.init(), Attendance.init(), FeePayment.init(), Note.init(), TestNote.init()]);
  hash = await bcrypt.hash('test-password-123', 12);
  mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => {
    const chunks = [];
    return new Writable({
      write(chunk, encoding, done) { chunks.push(chunk); done(); },
      final(done) {
        uploads.push({ options, bytes: Buffer.concat(chunks) });
        callback(null, { public_id: options.public_id || 'profiles/test',
          secure_url: 'https://res.cloudinary.com/test-cloud/image/authenticated/test.png' });
        done();
      },
    });
  });
  mock.method(cloudinary.uploader, 'destroy', async (id, options) => {
    deletions.push({ id, options }); return { result: 'ok' };
  });
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}/api`;
  productionServer = createApp({ production: true, trustProxy: 'loopback',
    allowedOrigins: ['https://portal.example.test'] }).listen(0, '127.0.0.1');
  await once(productionServer, 'listening');
  productionBase = `http://127.0.0.1:${productionServer.address().port}/api`;
}, { timeout: 240000 });

beforeEach(async () => {
  await Promise.all([Admin, Teacher, Student, Attendance, FeePayment, Note, TestNote, PasswordRequest, WhatsAppSession, Counter]
    .map((model) => model.deleteMany({})));
  const [admin] = await Admin.insertMany([{ _id: ids.admin, name: 'Test Admin', email: 'admin@example.test', password: hash }]);
  const [teacher, otherTeacher] = await Teacher.insertMany([
    { _id: ids.teacher, name: 'Test Teacher', email: 'teacher@example.test', password: hash, phone: '0000000000', batchName: 'A' },
    { _id: ids.otherTeacher, name: 'Other Teacher', email: 'other@example.test', password: hash, phone: '0000000000', batchName: 'B' },
  ]);
  const [student, otherStudent, futureStudent] = await Student.insertMany([
    { _id: ids.student, rollNumber: 'MA260901', name: 'Test Student', studentClass: '09', assignedTeacher: ids.teacher,
      fees: 5000, feesPaid: 0, password: hash, phone: '0000000000', enrollmentDate: new Date('2026-09-01') },
    { _id: ids.otherStudent, rollNumber: 'MA261002', name: 'Other Student', studentClass: '10', assignedTeacher: ids.otherTeacher,
      fees: 6000, password: hash, phone: '0000000000', enrollmentDate: new Date('2026-09-01') },
    { _id: ids.futureStudent, rollNumber: 'MA260903', name: 'Future Student', studentClass: '09', assignedTeacher: ids.teacher,
      fees: 5000, password: hash, phone: '0000000000', enrollmentDate: new Date('2099-01-01') },
  ]);
  users = { admin, teacher, otherTeacher, student, otherStudent, futureStudent };
  tokens = Object.fromEntries(Object.entries(users).map(([name, user]) =>
    [name, issueToken(user, name.includes('Teacher') || name === 'teacher' ? 'teacher' : name === 'admin' ? 'admin' : 'student')]));
  uploads = []; deletions = [];
});

after(async () => {
  await Promise.all([server, productionServer].filter(Boolean).map(async (http) => {
    http.closeAllConnections(); await new Promise((resolve) => http.close(resolve));
  }));
  await mongoose.disconnect(); if (database) await database.stop(); mock.restoreAll();
});

async function request(route, { role, token, method = 'GET', body, headers = {}, root = base } = {}) {
  const bearer = token ?? tokens[role];
  const init = { method, headers: { ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}), ...headers } };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.headers['Content-Type'] ||= 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const response = await fetch(root + route, init);
  const result = await response.json();
  return { status: response.status, body: result, headers: response.headers };
}
function multipart(name, bytes, fields = {}, field = 'file') {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  data.append(field, new Blob([bytes]), name); return data;
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWP4Oo/7PwgzwBgAXxAKdSOmW7EAAAAASUVORK5CYII=', 'base64');
const noteFields = { displayName: 'Test note', class: '9th', subject: 'Math', description: 'Fixture' };
async function note(grade = '9th', teacher = ids.teacher, extra = {}) {
  return Note.create({ displayName: 'Class note', class: grade, subject: 'Math', uploadedBy: teacher,
    fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/old.pdf',
    publicId: 'myacademy_notes_private/test.pdf', fileSize: '1 KB', fileType: 'PDF', ...extra });
}

test('private record option persists through multipart create/edit and rejects forged policy dates', async () => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: 'Record Student', studentClass: '09', assignedTeacher: String(ids.teacher),
    fees: '8450', phone: '0000000000', password: 'record-password', feeExempt: 'true' })) data.append(key, value);
  const created = await request('/students', { role: 'admin', method: 'POST', body: data });
  assert.equal(created.status, 201); assert.equal(created.body.feeExempt, true); assert.equal(created.body.fees, 8450);
  const stored = await Student.findById(created.body._id).select('+feeExempt +feeExemptFrom');
  const { month, year } = currentBillingPeriod();
  assert.equal(stored.feeExemptFrom.toISOString(), new Date(Date.UTC(year, month, 1)).toISOString());
  const edited = await request(`/students/${stored._id}`, { role: 'admin', method: 'PUT', body: { name: 'Updated Record' } });
  assert.equal(edited.status, 200); assert.equal(edited.body.feeExempt, true);
  assert.equal((await request('/students', { role: 'admin' })).body.find((s) => s._id === String(stored._id)).feeExempt, true);
  for (const body of [{ feeExempt: 'yes' }, { feeExemptFrom: '1900-01-01' }]) {
    assert.equal((await request(`/students/${stored._id}`, { role: 'admin', method: 'PUT', body })).status, 400);
  }
});

test('automatic paid status excludes dummy amounts and existing dummy receipts from dashboard totals', async () => {
  const { month, year } = currentBillingPeriod();
  assert.equal((await request('/teacher/dashboard', { role: 'teacher' })).body.metrics.feeRemaining, 5000);
  await FeePayment.create({ student: ids.student, teacher: ids.teacher, month, year, status: 'submitted' });
  assert.equal((await request('/teacher/dashboard', { role: 'teacher' })).body.metrics.feeReceived, 5000);
  assert.equal((await request(`/students/${ids.student}`, { role: 'admin', method: 'PUT', body: { feeExempt: true } })).status, 200);
  const metrics = (await request('/teacher/dashboard', { role: 'teacher' })).body.metrics;
  assert.deepEqual(metrics, { feeReceived: 0, feeRemaining: 0, totalStudents: 1 });
  // The option changes accounting, never deletes historical records.
  assert.equal(await FeePayment.countDocuments(), 1);
});

test('current and future fees appear paid on every surface without creating payment records or exposing the setting', async () => {
  const { month, year } = currentBillingPeriod();
  await request(`/students/${ids.student}`, { role: 'admin', method: 'PUT', body: { feeExempt: true } });
  for (const offset of [0, 1, 15]) {
    const selected = new Date(Date.UTC(year, month + offset, 1));
    const m = selected.getUTCMonth(), y = selected.getUTCFullYear();
    const roster = await request(`/teacher/fee?month=${m}&year=${y}`, { role: 'teacher' });
    assert.equal(roster.body.find((s) => s._id === String(ids.student)).status, 'submitted');
    const overview = await request(`/teacher/stats/overview?studentId=${ids.student}&month=${m}&year=${y}`, { role: 'teacher' });
    assert.equal(overview.body.feeStatus, 'submitted');
    const classStats = await request(`/teacher/stats/class?month=${m}&year=${y}`, { role: 'teacher' });
    assert.equal(classStats.body.find((s) => s._id === String(ids.student)).feeStatus, 'submitted');
    const dashboard = await request(`/student/dashboard?month=${m + 1}&year=${y}`, { role: 'student' });
    assert.equal(dashboard.body.fee.status, 'PAID'); assert.equal(dashboard.body.fee.paidAmount, 5000);
    assert.equal(dashboard.body.fee.lastPaidDate, null);
    const marked = await request('/teacher/fee/pay', { role: 'teacher', method: 'POST', body: { studentId: String(ids.student), month: m, year: y } });
    assert.equal(marked.status, 200);
    for (const response of [roster, overview, classStats, dashboard, marked]) assert.ok(!JSON.stringify(response.body).includes('feeExempt'));
  }
  for (const [path, role] of [['/admin/profile', 'student'], ['/teacher/stats/students', 'teacher']]) {
    assert.ok(!JSON.stringify((await request(path, { role })).body).includes('feeExempt'));
  }
  assert.equal(await FeePayment.countDocuments(), 0);
});

test('earlier months retain their status and turning the record option off restores normal billing', async () => {
  const { month, year } = currentBillingPeriod();
  await Student.updateOne({ _id: ids.student }, { enrollmentDate: new Date('2020-01-01') });
  await request(`/students/${ids.student}`, { role: 'admin', method: 'PUT', body: { feeExempt: true } });
  const prior = new Date(Date.UTC(year, month - 1, 1));
  const route = `/teacher/fee?month=${prior.getUTCMonth()}&year=${prior.getUTCFullYear()}`;
  assert.equal((await request(route, { role: 'teacher' })).body[0].status, 'pending');
  assert.equal((await request(`/student/dashboard?month=${prior.getUTCMonth() + 1}&year=${prior.getUTCFullYear()}`, { role: 'student' })).body.fee.status, 'PENDING');
  await request(`/students/${ids.student}`, { role: 'admin', method: 'PUT', body: { feeExempt: false } });
  assert.equal((await request(`/teacher/fee?month=${month}&year=${year}`, { role: 'teacher' })).body[0].status, 'pending');
  assert.equal((await request('/teacher/dashboard', { role: 'teacher' })).body.metrics.feeRemaining, 5000);
});

test('test notes preserve multiline text, date order, pinning, search, edits and deletion', async () => {
  const content = 'Shayan:-\nScience --> ch#5\n\nHasnain:-\nMath --> Ex#10.1\n<script>alert(1)</script>';
  const a = await request('/test-notes', { role: 'teacher', method: 'POST', body: { date: '2026-10-21', content } });
  const b = await request('/test-notes', { role: 'teacher', method: 'POST', body: { date: '2026-10-26', content: 'Physics --> Satellites and orbits' } });
  assert.equal(a.status, 201); assert.equal(b.status, 201); assert.equal(a.body.content, content);
  const list = () => request('/test-notes', { role: 'teacher' });
  assert.deepEqual((await list()).body.notes.map((n) => n.date), ['2026-10-26', '2026-10-21']);
  assert.equal((await request('/test-notes?q=21-10-2026', { role: 'teacher' })).body.notes[0]._id, a.body._id);
  assert.equal((await request('/test-notes?date=2026-10-26', { role: 'teacher' })).body.notes.length, 1);
  assert.equal((await request('/test-notes?q=Hasnain', { role: 'teacher' })).body.notes[0].content, content);
  assert.equal((await request('/test-notes?q=%5B', { role: 'teacher' })).status, 200);
  assert.equal((await request(`/test-notes/${a.body._id}`, { role: 'teacher', method: 'PUT', body: { pinned: true, title: 'Test plan' } })).status, 200);
  assert.equal((await list()).body.notes[0]._id, a.body._id);
  await request(`/test-notes/${a.body._id}`, { role: 'teacher', method: 'PUT', body: { pinned: false } });
  assert.equal((await list()).body.notes[0]._id, b.body._id);
  assert.equal((await request(`/test-notes/${a.body._id}`, { role: 'teacher', method: 'DELETE' })).status, 200);
  assert.equal((await list()).body.notes.length, 1);
});

test('test notes require teacher authentication, reject admins/students, isolate each owner and reject unsafe/invalid inputs', async () => {
  const created = await request('/test-notes', { role: 'teacher', method: 'POST', body: { date: '2026-10-24', content: 'Private test assignments' } });
  assert.equal((await request('/test-notes')).status, 401);
  for (const role of ['otherTeacher']) {
    assert.equal((await request('/test-notes', { role })).body.notes.length, 0);
    for (const method of ['PUT', 'DELETE']) assert.equal((await request(`/test-notes/${created.body._id}`, { role, method, body: method === 'PUT' ? { content: 'Hijacked' } : undefined })).status, 404);
  }
  for (const role of ['admin', 'student']) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE']) assert.equal((await request(method === 'PUT' || method === 'DELETE' ? `/test-notes/${created.body._id}` : '/test-notes', { role, method })).status, 403);
  }
  for (const body of [{ date: '2026-02-30', content: 'Invalid date' }, { date: '2026-10-24', content: '   ' },
    { date: '2026-10-24', content: 'x'.repeat(20001) }, { date: '2026-10-24', content: 'x', owner: String(ids.admin) },
    { date: '2026-10-24', content: 'x', pinned: 'true' }]) assert.equal((await request('/test-notes', { role: 'teacher', method: 'POST', body })).status, 400);
  for (const query of ['?date=bad', '?page=0', '?q[$ne]=x']) assert.equal((await request('/test-notes' + query, { role: 'teacher' })).status, 400);

});

test('test notes pagination exposes every note without duplicates', async () => {
  await TestNote.insertMany(Array.from({ length: 53 }, (_, i) => ({ owner: ids.teacher, ownerRole: 'teacher', date: '2026-10-24', content: `Note ${i}` })));
  const first = (await request('/test-notes', { role: 'teacher' })).body;
  const second = (await request('/test-notes?page=2', { role: 'teacher' })).body;
  assert.equal(first.notes.length, 50); assert.equal(first.hasMore, true);
  assert.equal(second.notes.length, 3); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.notes, ...second.notes].map((n) => n._id)).size, 53);
});

test('shared profile accepts all three roles and never returns password hashes', async () => {
  for (const role of ['admin', 'teacher', 'student']) {
    const response = await request('/admin/profile', { role });
    assert.equal(response.status, 200); assert.equal(response.body.role, role);
    assert.equal(response.body.password, undefined); assert.ok(!JSON.stringify(response.body).includes(hash));
  }
  assert.equal((await request('/students')).status, 401);
  assert.equal((await request('/students', { token: 'forged' })).status, 401);
});

test('selected login role never falls back to another account type', async () => {
  const identifiers = { admin: 'admin@example.test', teacher: 'teacher@example.test', student: 'MA260901' };
  for (const role of ['admin', 'teacher', 'student']) {
    for (const [accountRole, identifier] of Object.entries(identifiers)) {
      const response = await request('/auth/login', { method: 'POST', body: { role, identifier, password: 'test-password-123' } });
      assert.equal(response.status, role === accountRole ? 200 : 401);
      if (role !== accountRole) assert.equal(response.body.token, undefined);
    }
  }
});

test('all roles get seven-day sessions and day-six refresh restarts the full seven days', async () => {
  const now = Math.floor(Date.now() / 1000);
  for (const role of ['admin', 'teacher', 'student']) {
    const issued = jwt.decode(tokens[role]);
    assert.equal(issued.exp - issued.iat, 7 * 86400);
    const old = jwt.sign({ ...issued, iat: now - 6 * 86400, exp: now + 86400 }, security.jwtSecret, { algorithm: 'HS256' });
    const response = await request('/auth/refresh', { token: old, method: 'POST', body: {} });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const renewed = jwt.verify(response.body.token, security.jwtSecret, { algorithms: ['HS256'], issuer: security.jwtIssuer, audience: security.jwtAudience });
    assert.equal(renewed.role, role); assert.equal(renewed.exp - renewed.iat, 7 * 86400);
    assert.ok(renewed.exp >= now + 7 * 86400); assert.notEqual(renewed.jti, issued.jti);
    assert.equal(response.body.admin.role, role); assert.equal(response.body.admin.password, undefined);
    assert.ok(!JSON.stringify(response.body.admin).includes('feeExempt'));
  }
});

test('refresh rejects missing, expired, forged, deleted-account and password-revoked sessions', async () => {
  assert.equal((await request('/auth/refresh', { method: 'POST', body: {} })).status, 401);
  assert.equal((await request('/auth/refresh', { method: 'POST', token: 'forged', body: {} })).status, 401);
  const expired = jwt.sign({ ...jwt.decode(tokens.admin), exp: Math.floor(Date.now() / 1000) - 1 }, security.jwtSecret);
  assert.equal((await request('/auth/refresh', { method: 'POST', token: expired, body: {} })).status, 401);
  await Student.deleteOne({ _id: ids.student });
  assert.equal((await request('/auth/refresh', { method: 'POST', role: 'student', body: {} })).status, 401);
  await Teacher.updateOne({ _id: ids.teacher }, { password: 'different-password-hash' });
  assert.equal((await request('/auth/refresh', { method: 'POST', role: 'teacher', body: {} })).status, 401);
});

test('student chart is limited to 15 calendar days while summary keeps all eligible records', async () => {
  await Student.updateOne({ _id: ids.student }, { enrollmentDate: new Date('2020-01-01') });
  const windowFor = require('../utils/studentChartWindow');
  const range = windowFor('all');
  const end = new Date(`${range.end}T00:00:00Z`);
  await Attendance.insertMany(Array.from({ length: 40 }, (_, i) => ({ student: ids.student, teacher: ids.teacher,
    date: new Date(end.getTime() - i * 86400000), status: i % 2 ? 'absent' : 'present' })));
  await Attendance.create({ student: ids.student, teacher: ids.teacher, date: new Date('2019-01-01'), status: 'absent' });
  const response = await request('/student/dashboard', { role: 'student' });
  assert.equal(response.status, 200); assert.equal(response.body.attendance.totalDays, 40);
  assert.equal(response.body.attendance.percentage, 50);
  assert.equal(response.body.attendanceTrends.length, 15);
  assert.equal(response.body.attendanceTrends[0].date, range.start);
  assert.equal(response.body.attendanceTrends.at(-1).date, range.end);
  assert.equal(response.body.attendanceTrends.at(-1).percentage, 50);
  const future = await request('/student/dashboard?viewMode=monthly&month=1&year=2099', { role: 'student' });
  assert.deepEqual(future.body.attendanceTrends, []); assert.equal(future.body.attendanceTrendWindow, null);
});

test('student study materials include all class notes across subjects without provider URLs or foreign classes', async () => {
  for (let i = 0; i < 9; i++) await note(i % 2 ? '09' : '9th', ids.teacher,
    { displayName: `Resource ${i}`, subject: i < 4 ? 'Math' : 'English' });
  await note('10th', ids.otherTeacher, { displayName: 'Foreign class resource', subject: 'Physics' });
  const response = await request('/student/dashboard', { role: 'student' });
  assert.equal(response.status, 200); assert.equal(response.body.recentNotes.length, 9);
  assert.deepEqual([...new Set(response.body.recentNotes.map((n) => n.subject))].sort(), ['English', 'Math']);
  assert.ok(response.body.recentNotes.every((n) => !n.fileUrl && !n.publicId));
  assert.equal(response.body.notices, undefined);
});

for (const [method, route] of [['GET', '/students'], ['POST', '/students'], ['PUT', `/students/${ids.student}`],
  ['DELETE', `/students/${ids.student}`], ['GET', '/teachers'], ['POST', '/teachers'],
  ['PUT', `/teachers/${ids.teacher}`], ['DELETE', `/teachers/${ids.teacher}`], ['PUT', '/admin/profile'],
  ['POST', '/admin/profile/picture'], ['GET', '/admin/password-requests'],
  ['PUT', `/admin/password-requests/${ids.student}/resolve`], ['DELETE', `/admin/password-requests/${ids.student}`]]) {
  test(`${method} ${route} rejects non-admin roles before any mutation`, async () => {
    for (const role of ['teacher', 'student']) assert.equal((await request(route, { role, method, body: method === 'GET' ? undefined : {} })).status, 403);
    assert.equal(await Student.countDocuments(), 3); assert.equal(await Teacher.countDocuments(), 2);
  });
}

test('role-specific dashboards reject other roles and load authorized dashboards', async () => {
  for (const role of ['admin', 'student']) assert.equal((await request('/teacher/dashboard', { role })).status, 403);
  for (const role of ['admin', 'teacher']) assert.equal((await request('/student/dashboard', { role })).status, 403);
  assert.equal((await request('/teacher/dashboard', { role: 'teacher' })).status, 200);
  assert.equal((await request('/student/dashboard', { role: 'student' })).status, 200);
});

test('real bcrypt login and CRUD work; admin password change renews session and revokes older token', async () => {
  for (const [role, identifier] of [['admin', 'admin@example.test'], ['teacher', 'teacher@example.test'], ['student', 'MA260901']]) {
    const response = await request('/auth/login', { method: 'POST', body: { identifier, password: 'test-password-123', role } });
    assert.equal(response.status, 200); assert.equal(response.body.admin.role, role);
    assert.equal((await request('/admin/profile', { token: response.body.token })).status, 200);
  }
  const profile = await request('/admin/profile', { role: 'admin', method: 'PUT', body: { name: 'Updated Admin' } });
  assert.equal(profile.status, 200); assert.equal(profile.body.admin.role, 'admin');
  const changed = await request('/admin/profile', { role: 'admin', method: 'PUT', body: { password: 'new-password-456' } });
  assert.equal(changed.status, 200); assert.ok(changed.body.token); assert.equal(changed.body.admin.role, 'admin');
  assert.equal((await request('/admin/profile', { token: tokens.admin })).status, 401);
  assert.equal((await request('/admin/profile', { token: changed.body.token })).status, 200);
});

test('admin can create/edit/delete accounts and teacher reset revokes its prior session', async () => {
  const created = await request('/teachers', { role: 'admin', method: 'POST', body: {
    name: 'Temporary', email: 'temporary@example.test', phone: '0000000000', batchName: 'C', password: 'test-password-123' } });
  assert.equal(created.status, 201); assert.equal(created.body.password, undefined);
  const newStudent = await request('/students', { role: 'admin', method: 'POST', body: {
    name: 'Temporary Student', studentClass: '09', assignedTeacher: created.body._id, fees: 1000,
    phone: '0000000000', password: 'test-password-123', enrollmentDate: '2026-09-01' } });
  assert.equal(newStudent.status, 201, JSON.stringify(newStudent.body)); assert.equal(newStudent.body.password, undefined);
  assert.match(newStudent.body.rollNumber, /^MA\d{4}B\d+-00$/);
  const batchLogin = await request('/auth/login', { method: 'POST', body: {
    identifier: newStudent.body.rollNumber.toLowerCase(), password: 'test-password-123', role: 'student',
  } });
  assert.equal(batchLogin.status, 200); assert.equal(batchLogin.body.admin._id, newStudent.body._id);
  assert.equal((await request(`/students/${newStudent.body._id}`, { role: 'admin', method: 'PUT', body: { fees: 1200 } })).status, 200);
  assert.equal((await request(`/students/${newStudent.body._id}`, { role: 'admin', method: 'DELETE' })).status, 200);
  assert.equal((await request(`/teachers/${created.body._id}`, { role: 'admin', method: 'DELETE' })).status, 200);
  assert.equal((await request(`/teachers/${ids.teacher}`, { role: 'admin', method: 'PUT', body: { password: 'reset-password-789' } })).status, 200);
  assert.equal((await request('/admin/profile', { token: tokens.teacher })).status, 401);
});

test('attendance rejects mixed/foreign/future roster with no writes', async () => {
  for (const invalidId of [ids.otherStudent, ids.futureStudent, new mongoose.Types.ObjectId()]) {
    const response = await request('/teacher/attendance', { role: 'teacher', method: 'POST', body: { date: '2026-10-01', records: [
      { studentId: ids.student.toString(), status: 'present' }, { studentId: invalidId.toString(), status: 'absent' }] } });
    assert.equal(response.status, 403); assert.equal(await Attendance.countDocuments(), 0);
  }
});

test('attendance handles submit/edit/reset with real MongoDB unique index', async () => {
  const body = { date: '2026-10-01', records: [{ studentId: ids.student.toString(), status: 'present' }] };
  assert.equal((await request('/teacher/attendance', { role: 'teacher', method: 'POST', body })).status, 200);
  body.records[0].status = 'leave';
  assert.equal((await request('/teacher/attendance', { role: 'teacher', method: 'POST', body })).status, 200);
  assert.equal(await Attendance.countDocuments(), 1);
  assert.equal((await Attendance.findOne()).status, 'leave');
  const roster = await request('/teacher/attendance?date=2026-10-01', { role: 'teacher' });
  assert.equal(roster.body.students.length, 1); assert.equal(roster.body.students[0].status, 'leave');
  assert.equal((await request('/teacher/attendance?date=2026-10-01', { role: 'teacher', method: 'DELETE' })).status, 200);
  assert.equal(await Attendance.countDocuments(), 0);
});

test('attendance belonging to another teacher is preserved', async () => {
  await Attendance.create({ student: ids.student, teacher: ids.otherTeacher, date: new Date('2026-10-01'), status: 'absent' });
  assert.equal((await request('/teacher/attendance', { role: 'teacher', method: 'POST', body: {
    date: '2026-10-01', records: [{ studentId: ids.student.toString(), status: 'present' }] } })).status, 409);
  assert.equal((await Attendance.findOne()).status, 'absent');
});

test('invalid records, object injection, IDs, dates and periods return 400 without writes', async () => {
  const valid = { studentId: ids.student.toString(), status: 'present' };
  for (const body of [{ date: '2026-02-30', records: [valid] }, { date: '2026-10-01', records: [valid, valid] },
    { date: '2026-10-01', records: [{ ...valid, status: 'unknown' }] },
    { date: '2026-10-01', records: [{ ...valid, studentId: { $ne: null } }] }]) {
    assert.equal((await request('/teacher/attendance', { role: 'teacher', method: 'POST', body })).status, 400);
  }
  assert.equal((await request('/students/not-an-id', { role: 'admin', method: 'DELETE' })).status, 400);
  assert.equal((await request('/auth/login', { method: 'POST', body: { identifier: { $ne: null }, password: 'test' } })).status, 400);
  assert.equal((await request('/teacher/fee?month=12&year=2026', { role: 'teacher' })).status, 400);
  assert.equal((await request('/student/dashboard?month=0', { role: 'student' })).status, 400);
  assert.equal(await Attendance.countDocuments(), 0);
});

test('fees and stats enforce ownership; teacher payment appears correctly on student dashboard', async () => {
  assert.equal((await request('/teacher/fee/pay', { role: 'teacher', method: 'POST', body: { studentId: ids.otherStudent, month: 9, year: 2026 } })).status, 404);
  assert.equal((await request(`/teacher/stats/overview?studentId=${ids.otherStudent}`, { role: 'teacher' })).status, 404);
  assert.equal((await request('/teacher/fee/pay', { role: 'teacher', method: 'POST', body: { studentId: ids.student, month: 9, year: 2026 } })).status, 200);
  const dashboard = await request('/student/dashboard?month=10&year=2026', { role: 'student' });
  assert.equal(dashboard.status, 200); assert.equal(dashboard.body.fee.status, 'PAID');
  assert.equal(dashboard.body.fee.amount, 5000); assert.equal(dashboard.body.fee.paidAmount, 5000);
});

test('student fee months handle January/December and pending records without missing amounts', async () => {
  for (const month of [0, 11]) {
    await FeePayment.create({ student: ids.student, teacher: ids.teacher, month, year: 2026, status: 'submitted' });
    const response = await request(`/student/dashboard?month=${month + 1}&year=2026`, { role: 'student' });
    assert.equal(response.body.fee.status, 'PAID'); assert.equal(response.body.fee.amount, 5000);
    assert.equal(response.body.fee.paidAmount, 5000); assert.ok(response.body.fee.lastPaidDate);
  }
  await FeePayment.updateOne({ month: 11 }, { $set: { status: 'pending' } });
  const pending = await request('/student/dashboard?month=12&year=2026', { role: 'student' });
  assert.equal(pending.body.fee.status, 'PENDING'); assert.equal(pending.body.fee.paidAmount, 0);
});

test('note listing/downloads enforce class scope and hide provider IDs/URLs', async () => {
  const own = await note(); const foreign = await note('10th', ids.otherTeacher, { publicId: 'myacademy_notes_private/foreign.pdf' });
  const listing = await request('/notes', { role: 'student' });
  assert.equal(listing.status, 200); assert.equal(listing.body.length, 1);
  assert.equal(listing.body[0].fileUrl, undefined); assert.equal(listing.body[0].publicId, undefined);
  assert.equal((await request(`/notes/${foreign._id}/download`, { role: 'student' })).status, 404);
  const grant = await request(`/notes/${own._id}/download`, { role: 'student' });
  assert.equal(grant.status, 200);
  const url = new URL(grant.body.downloadUrl);
  assert.equal(url.searchParams.get('type'), 'authenticated'); assert.ok(url.searchParams.get('signature'));
  assert.ok(Number(url.searchParams.get('expires_at')) <= Date.now() / 1000 + 301);
  assert.equal((await request(`/notes/${foreign._id}`, { role: 'teacher', method: 'DELETE' })).status, 403);
  assert.equal(deletions.length, 0);
});

test('new note uploads use private delivery; authorized deletion removes correct delivery type', async () => {
  const uploaded = await request('/notes', { role: 'teacher', method: 'POST', body: multipart('pixel.png', png, noteFields) });
  assert.equal(uploaded.status, 201); assert.equal(uploaded.body.fileUrl, undefined);
  assert.equal(uploads[0].options.type, 'authenticated');
  assert.ok(uploads[0].options.public_id.startsWith('myacademy_notes_private/'));
  assert.ok(uploads[0].options.public_id.includes('/class-09/math/teacher-'));
  assert.equal(uploads[0].options.display_name, noteFields.displayName);
  assert.equal((await request(`/notes/${uploaded.body._id}`, { role: 'teacher', method: 'DELETE' })).status, 200);
  assert.equal(deletions[0].options.type, 'authenticated'); assert.equal(deletions[0].options.invalidate, true);
});

test('profile uploads and supported note formats pass actual multipart/signature parsing', async () => {
  assert.equal((await request('/admin/profile/picture', { role: 'admin', method: 'POST', body: multipart('pixel.png', png, {}, 'profilePicture') })).status, 200);
  for (const filename of ['sample.pdf', 'sample.docx', 'sample.xlsx', 'sample.pptx', 'sample.csv']) {
    const response = await request('/notes', { role: 'teacher', method: 'POST',
      body: multipart(filename, fs.readFileSync(path.join(__dirname, 'fixtures', filename)), noteFields) });
    assert.equal(response.status, 201, `${filename}: ${JSON.stringify(response.body)}`);
  }
});

test('note metadata failures clean up uploads and provider deletion failures retain the note for retry', async (t) => {
  const create = t.mock.method(Note, 'create', async () => { throw new Error('Simulated metadata write failure'); });
  const failed = await request('/notes', { role: 'teacher', method: 'POST', body: multipart('pixel.png', png, noteFields) });
  assert.equal(failed.status, 500); assert.equal(deletions.length, 1);
  assert.equal(deletions[0].options.type, 'authenticated'); create.mock.restore();
  const retained = await note();
  t.mock.method(cloudinary.uploader, 'destroy', async () => { throw new Error('Provider unavailable'); });
  assert.equal((await request(`/notes/${retained._id}`, { role: 'teacher', method: 'DELETE' })).status, 502);
  assert.ok(await Note.exists({ _id: retained._id }));
});

test('note folder organization is previewable, resumable, and never changes delivery URLs', async (t) => {
  const item = await note();
  let folder = '';
  const calls = [];
  t.mock.method(cloudinary.api, 'config', async () => ({ settings: { folder_mode: 'dynamic' } }));
  t.mock.method(cloudinary.api, 'resource', async () => ({ public_id: item.publicId, asset_folder: folder }));
  t.mock.method(cloudinary.api, 'update', async (id, options) => {
    calls.push({ id, options }); folder = options.asset_folder; return { public_id: id, asset_folder: folder };
  });
  const organize = require('../scripts/organize-notes');
  const preview = await organize(); assert.equal(preview.planned, 1); assert.equal(calls.length, 0);
  const applied = await organize({ apply: true, backupDir: path.join(__dirname, '../.cache/folder-test-backups') });
  assert.equal(applied.updated, 1); assert.equal(calls[0].options.type, 'authenticated');
  assert.ok(folder.includes('class-09/math/teacher-'));
  assert.equal((await Note.findById(item._id)).publicId, item.publicId);
  assert.equal((await Note.findById(item._id)).fileUrl, item.fileUrl);
  assert.equal((await organize({ apply: true })).updated, 0);
});

test('static assets compress and use immutable hashed caching while HTML and private APIs revalidate or remain private', async () => {
  const dir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'myacademy-static-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><body>Portal</body></html>');
  fs.writeFileSync(path.join(dir, 'assets/app-abc.js'), '/* compressed fixture */\n'.repeat(200));
  const http = createApp({ staticDir: dir }).listen(0, '127.0.0.1'); await once(http, 'listening');
  const origin = `http://127.0.0.1:${http.address().port}`;
  try {
    const asset = await fetch(origin + '/assets/app-abc.js', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(asset.headers.get('content-encoding'), 'gzip');
    assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.ok((await asset.text()).includes('compressed fixture'));
    const brotli = await fetch(origin + '/assets/app-abc.js', { headers: { 'Accept-Encoding': 'br' } });
    assert.equal(brotli.headers.get('content-encoding'), 'br'); await brotli.text();
    const html = await fetch(origin + '/teacher/dashboard');
    assert.equal(html.status, 200); assert.equal(html.headers.get('cache-control'), 'no-cache');
    assert.equal((await fetch(origin + '/api/not-a-route')).status, 404);
    const privateResponse = await request('/student/dashboard', { role: 'student' });
    assert.equal(privateResponse.headers.get('cache-control'), 'no-store');
  } finally { http.closeAllConnections(); await new Promise((resolve) => http.close(resolve)); }
});

test('fake images, executable formats and oversize uploads fail before provider calls', async () => {
  for (const filename of ['fake.png', 'malicious.svg', 'malicious.exe']) {
    assert.equal((await request('/notes', { role: 'teacher', method: 'POST', body: multipart(filename, Buffer.from('plain text'), noteFields) })).status, 400);
  }
  assert.equal((await request('/admin/profile/picture', { role: 'admin', method: 'POST',
    body: multipart('huge.png', Buffer.alloc(5 * 1024 * 1024 + 1), {}, 'profilePicture') })).status, 413);
  assert.equal(uploads.length, 0);
});

test('headers, exact CORS, HTTPS/proxy handling and malformed body errors work', async () => {
  const health = await request('/health');
  assert.equal(health.headers.get('x-powered-by'), null);
  assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(health.headers.get('cache-control'), 'no-store'); assert.ok(health.headers.get('x-request-id'));
  assert.equal((await request('/health', { headers: { Origin: 'https://evil.example' } })).status, 403);
  const allowed = await request('/health', { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal((await request('/admin/profile', { role: 'admin', root: productionBase })).status, 400);
  const secure = await request('/admin/profile', { role: 'admin', root: productionBase, headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(secure.status, 200); assert.ok(secure.headers.get('strict-transport-security'));
  const untrusted = createApp({ production: true, trustProxy: false }).listen(0, '127.0.0.1');
  await once(untrusted, 'listening');
  try {
    assert.equal((await request('/admin/profile', { role: 'admin',
      root: `http://127.0.0.1:${untrusted.address().port}/api`, headers: { 'X-Forwarded-Proto': 'https' } })).status, 400);
  } finally { untrusted.closeAllConnections(); await new Promise((resolve) => untrusted.close(resolve)); }
  assert.equal((await request('/auth/login', { method: 'POST', body: '{' })).status, 400);
  assert.equal((await request('/auth/login', { method: 'POST', body: { identifier: 'x'.repeat(300000) } })).status, 413);
});

test('failed login and recovery rate limits return 429 with retry information', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await request('/auth/login', { method: 'POST', body: {
    identifier: 'rate-limit-fixture@example.test', password: 'wrong', role: 'teacher' } })).status, 401);
  const blocked = await request('/auth/login', { method: 'POST', body: { identifier: 'rate-limit-fixture@example.test', password: 'wrong', role: 'teacher' } });
  assert.equal(blocked.status, 429); assert.ok(blocked.headers.get('retry-after'));
  for (let i = 0; i < 5; i++) assert.equal((await request('/auth/forgot-password', { method: 'POST', body: { identifier: 'test' } })).status, 201);
  assert.equal((await request('/auth/forgot-password', { method: 'POST', body: { identifier: 'test' } })).status, 429);
});

test('JWT rejects expired tokens, missing role, wrong issuer and wrong algorithm', async () => {
  const payload = jwt.decode(tokens.admin);
  for (const [claims, options] of [[{ ...payload, exp: 1 }, { algorithm: 'HS256' }],
    [{ ...payload, role: undefined }, { algorithm: 'HS256' }],
    [{ ...payload, iss: 'wrong' }, { algorithm: 'HS256' }], [payload, { algorithm: 'HS384' }]]) {
    assert.equal((await request('/admin/profile', { token: jwt.sign(claims, security.jwtSecret, options) })).status, 401);
  }
});

test('WhatsApp credentials encrypt, survive reload, and reject tampered ciphertext', async () => {
  const state = await useMongoDBAuthState(ids.teacher);
  await state.saveCreds(); await state.state.keys.set({ 'app-state-sync-key': { 'test.key': { data: 'test-value' } } });
  const stored = await WhatsAppSession.findOne({ teacherId: ids.teacher });
  assert.ok(stored.creds.startsWith('enc:v1:'));
  assert.ok(stored.keys.get('app-state-sync-key-test__dot__key').startsWith('enc:v1:'));
  const restored = await useMongoDBAuthState(ids.teacher);
  assert.equal(restored.state.creds.registrationId, state.state.creds.registrationId);
  assert.deepEqual(await restored.state.keys.get('app-state-sync-key', ['test.key']), { 'test.key': { data: 'test-value' } });
  const ciphertext = encryptCredential('{"secret":"fixture"}');
  const bytes = Buffer.from(ciphertext.slice(7), 'base64'); bytes[bytes.length - 1] ^= 1;
  assert.throws(() => decryptCredential('enc:v1:' + bytes.toString('base64')));
  assert.equal(decryptCredential('{"legacy":true}'), '{"legacy":true}');
});

test('startup refuses absent/weak JWT secrets and missing production encryption key', () => {
  for (const env of [{ JWT_SECRET: '', SESSION_SECRET: '' }, { JWT_SECRET: 'weak' },
    { NODE_ENV: 'production', WHATSAPP_AUTH_KEY: '', CORS_ORIGINS: 'https://portal.example.test' }]) {
    const result = spawnSync(process.execPath, ['-e', "require('./config/security')"], {
      cwd: path.join(__dirname, '..'), env: { ...process.env, ...env }, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
  }
});

test('unmocked application/provider modules import without opening database or WhatsApp connections', () => {
  const result = spawnSync(process.execPath, ['--require', './tests/setup.cjs', '-e',
    "const app = require('./app')(); if (typeof app.listen !== 'function') process.exit(1);"], {
    cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
});

test('WhatsApp migration supports dry-run, encryption, and safe repeat runs on the test DB', async () => {
  const migrate = require('../scripts/encrypt-whatsapp');
  await WhatsAppSession.create({ teacherId: ids.teacher, creds: '{"fixture":true}', keys: { fixture: '{"value":1}' } });
  assert.equal((await migrate({ connect: false, apply: false })).legacyFieldsFound, 2);
  assert.equal((await WhatsAppSession.findOne()).creds, '{"fixture":true}');
  assert.equal((await migrate({ connect: false, apply: true })).legacyFieldsFound, 2);
  const encrypted = await WhatsAppSession.findOne();
  assert.equal(decryptCredential(encrypted.creds), '{"fixture":true}');
  assert.equal(decryptCredential(encrypted.keys.get('fixture')), '{"value":1}');
  assert.equal((await migrate({ connect: false, apply: true })).legacyFieldsFound, 0);
});

test('private-note migration dry-run and recovery after interrupted DB save preserve delivery state', async () => {
  const migrate = require('../scripts/secure-notes');
  const legacy = await note('9th', ids.teacher, { publicId: 'legacy/fixture.pdf' });
  const assets = new Map(); let renames = 0; let failSave = true;
  const resource = mock.method(cloudinary.api, 'resource', async (id) => {
    if (assets.has(id)) return assets.get(id);
    throw Object.assign(new Error('not found'), { http_code: 404 });
  });
  const rename = mock.method(cloudinary.uploader, 'rename', async (oldId, newId, options) => {
    renames++; assert.equal(options.to_type, 'authenticated'); assert.equal(options.invalidate, true);
    const asset = { public_id: newId, secure_url: 'https://res.cloudinary.com/test-cloud/raw/authenticated/fixture.pdf' };
    assets.set(newId, asset); return asset;
  });
  const originalSave = Note.prototype.save;
  const save = mock.method(Note.prototype, 'save', function (...args) {
    if (this._id.equals(legacy._id) && failSave) { failSave = false; throw new Error('Simulated save failure'); }
    return originalSave.apply(this, args);
  });
  try {
    assert.equal((await migrate({ connect: false, apply: false })).pending, 1); assert.equal(renames, 0);
    assert.equal((await migrate({ connect: false, apply: true })).failed, 1);
    assert.equal((await Note.findById(legacy._id)).publicId, 'legacy/fixture.pdf');
    assert.equal((await migrate({ connect: false, apply: true })).failed, 0);
    assert.equal((await Note.findById(legacy._id)).publicId, `myacademy_notes_private/${legacy._id}.pdf`);
    assert.equal(renames, 1);
    assert.equal((await migrate({ connect: false, apply: true })).pending, 0);
  } finally { resource.mock.restore(); rename.mock.restore(); save.mock.restore(); }
});
