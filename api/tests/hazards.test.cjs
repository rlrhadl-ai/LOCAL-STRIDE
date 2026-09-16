// HTTP contract/security tests with an in-memory Prisma substitute. Never uses a real database.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const express = require('express');
const sharp = require('sharp');
const { prisma } = require('../dist/lib/prisma');
const { hazards } = require('../dist/routes/hazards');
const { errorHandler } = require('../dist/middleware/error');
const { distanceToRoute, csvCell } = require('../dist/lib/hazard-policy');
let server, origin, fixture, records, history, nextAuthor = 0;
const course = { id: 'course-1', name: '테스트 수변 코스', slug: 'test-course', areaName: '수성구', isPublic: true, polyline: [[35.82, 128.61], [35.84, 128.61]] };
const select = (row, fields) => row && Object.fromEntries(Object.entries(fields).filter(([, v]) => v).map(([k, v]) => [k, v === true ? row[k] : Array.isArray(row[k]) ? row[k].map((r) => select(r, v.select)) : select(row[k], v.select)]));
function matches(row, where = {}) {
  return Object.entries(where).every(([key, val]) => val === undefined || (key === 'OR' ? val.some((w) => matches(row, w)) : val && typeof val === 'object' ? ('in' in val ? val.in.includes(row[key]) : matches(row[key], val)) : row[key] === val));
}
function seed(overrides = {}) {
  const row = { id: randomUUID(), requestId: randomUUID(), courseId: course.id, course, authorId: 'author', category: 'SURFACE', severity: 'HIGH', status: 'RECEIVED', description: '공개 전 민감한 설명', publicNote: '', photo: fixture, lat: 35.83, lng: 128.61, accuracyM: 8, locationSource: 'GPS', version: 1, createdAt: new Date(), updatedAt: new Date(), history: [], ...overrides };
  records.push(row); return row;
}
before(async () => {
  fixture = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#123456' } }).jpeg().withMetadata().toBuffer();
  prisma.hazardReport.findUnique = async ({ where, select: s }) => select(records.find((r) => matches(r, where)), s);
  prisma.hazardReport.findFirst = prisma.hazardReport.findUnique;
  prisma.hazardReport.findMany = async ({ where, select: s, take, skip = 0 }) => records.filter((r) => matches(r, where)).slice(skip, skip + (take ?? records.length)).map((r) => select(r, s));
  prisma.hazardReport.count = async ({ where }) => records.filter((r) => matches(r, where)).length;
  prisma.hazardReport.groupBy = async () => [...new Set(records.map((r) => r.status))].map((status) => ({ status, _count: { _all: records.filter((r) => r.status === status).length } }));
  prisma.hazardReport.create = async ({ data, select: s }) => {
    if (records.some((r) => r.requestId === data.requestId)) throw Object.assign(new Error('unique'), { code: 'P2002' });
    return select(seed(data), s);
  };
  prisma.hazardReport.updateMany = async ({ where, data }) => {
    const row = records.find((r) => matches(r, where)); if (!row) return { count: 0 };
    Object.assign(row, data, { version: row.version + data.version.increment }); return { count: 1 };
  };
  prisma.hazardReportHistory.create = async ({ data }) => { history.push(data); return data; };
  prisma.course.findFirst = async ({ where, select: s }) => select(matches(course, where) ? course : null, s);
  prisma.course.findMany = async ({ select: s }) => [select(course, s)];
  prisma.$transaction = async (fn) => fn(prisma);
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => {
    const who = req.get('x-test-user');
    if (who) req.user = { id: who, email: `${who}@example.test`, nickname: who, role: who === 'admin' ? 'ADMIN' : 'USER', isAuthenticated: who !== 'device-only' };
    next();
  });
  app.use('/api', hazards); app.use(errorHandler);
  server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}/api`;
});
beforeEach(() => { records = []; history = []; course.isPublic = true; });
after(async () => { await new Promise((resolve) => server.close(resolve)); await prisma.$disconnect(); });
function request(path, who, init = {}) { return fetch(origin + path, { ...init, headers: { ...(who ? { 'x-test-user': who } : {}), ...init.headers } }); }
function form(overrides = {}, image = fixture) {
  const data = new FormData();
  const body = { requestId: randomUUID(), courseId: course.id, category: 'SURFACE', severity: 'HIGH', description: '바닥 판자가 파손되어 있어요.', lat: '35.83', lng: '128.61', locationSource: 'GPS', accuracyM: '8', consent: 'true', ...overrides };
  for (const [key, value] of Object.entries(body)) if (value != null) data.append(key, value);
  if (image) data.append('photo', new Blob([image], { type: 'image/jpeg' }), 'report.jpg');
  return data;
}
const submit = (body, who = `runner-${++nextAuthor}`) => request('/hazards', who, { method: 'POST', body });
test('geometry measures distance to segment, not just checkpoints', () => {
  assert.ok(distanceToRoute([35.83, 128.61], course.polyline) < 1);
  assert.ok(distanceToRoute([35.83, 128.64], course.polyline) > 500);
  assert.equal(distanceToRoute([35.83, 128.61], []), Infinity);
});
test('CSV quotes content and prevents spreadsheet formulas', () => {
  assert.equal(csvCell('=SUM(1,2)'), '"\'=SUM(1,2)"');
  assert.equal(csvCell('a"b'), '"a""b"');
  assert.ok(csvCell('\tformula').startsWith('"\''));
});
test('anonymous and device-only users cannot submit', async () => {
  assert.equal((await request('/hazards', null, { method: 'POST' })).status, 401);
  assert.equal((await submit(form(), 'device-only')).status, 401);
});
test('public feed hides pending descriptions, notes and photos; excludes resolved/hidden', async () => {
  seed({ publicNote: 'private note' }); seed({ status: 'CONFIRMED', description: '확인된 파손' });
  seed({ status: 'RESOLVED' }); seed({ status: 'HIDDEN' });
  const response = await request(`/hazards?courseId=${course.id}`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json(); assert.equal(result.total, 2);
  assert.equal(result.items[0].description, ''); assert.equal(result.items[0].publicNote, ''); assert.equal(result.items[0].photoUrl, null);
  assert.equal(result.items[1].description, '확인된 파손'); assert.ok(result.items[1].photoUrl);
  assert.ok(!('authorId' in result.items[0])); assert.ok(!('photo' in result.items[0]));
});
test('unpublished course reports and photos are not public', async () => {
  const row = seed({ status: 'CONFIRMED' }); course.isPublic = false;
  assert.equal((await (await request(`/hazards?courseId=${course.id}`)).json()).total, 0);
  assert.equal((await request(`/hazards/${row.id}/photo`)).status, 404);
});
test('pending/hidden photos require owner or admin; reviewed photos are public', async () => {
  const row = seed(); const path = `/hazards/${row.id}/photo`;
  assert.equal((await request(path)).status, 404); assert.equal((await request(path, 'someone')).status, 404);
  assert.equal((await request(path, 'author')).status, 200); assert.equal((await request(path, 'admin')).status, 200);
  row.status = 'CONFIRMED'; assert.equal((await request(path)).headers.get('content-type'), 'image/jpeg');
  row.status = 'HIDDEN'; assert.equal((await request(path)).status, 404);
});
test('valid upload stores sanitized JPEG and strips original metadata', async () => {
  const response = await submit(form()); assert.equal(response.status, 201);
  const info = await sharp(Buffer.from(records[0].photo)).metadata(); assert.equal(info.format, 'jpeg'); assert.equal(info.exif, undefined); assert.equal(info.icc, undefined);
  assert.equal(records[0].status, 'RECEIVED');
});
test('retry and simultaneous submission with same token create only one report', async () => {
  const requestId = randomUUID();
  const responses = await Promise.all([submit(form({ requestId }), 'retry-user'), submit(form({ requestId }), 'retry-user')]);
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]); assert.equal(records.length, 1);
  assert.equal((await submit(form({ requestId }), 'other-user')).status, 409);
});
test('missing consent/photo, inaccurate GPS, remote coordinates and invalid image rejected', async () => {
  for (const [changes, image] of [[{ consent: 'false' }, fixture], [{}, null], [{ accuracyM: '101' }, fixture], [{ accuracyM: null }, fixture], [{ lat: '37.5' }, fixture], [{}, Buffer.from('<svg></svg>')]]) {
    assert.equal((await submit(form(changes, image))).status, 400, JSON.stringify(changes));
  }
  assert.equal(records.length, 0);
});
test('manual location works without GPS accuracy', async () => {
  assert.equal((await submit(form({ locationSource: 'MAP', accuracyM: null }))).status, 201);
});
test('admin list, detail, export and mutation reject ordinary users', async () => {
  const row = seed();
  for (const path of ['/admin/hazards', `/admin/hazards/${row.id}`, '/admin/hazards/export']) assert.equal((await request(path, 'runner')).status, 401);
  assert.equal((await request(`/admin/hazards/${row.id}`, 'runner', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
});
test('admin filtering and CSV include coordinates but never photo bytes or author identity', async () => {
  seed({ description: '=1+1' }); seed({ category: 'FACILITY', status: 'CONFIRMED' });
  const result = await (await request('/admin/hazards?category=SURFACE', 'admin')).json(); assert.equal(result.total, 1); assert.equal(result.counts.CONFIRMED, 1);
  const csv = await (await request('/admin/hazards/export?category=SURFACE', 'admin')).text();
  assert.ok(csv.includes('35.83')); assert.ok(csv.includes("'=1+1")); assert.ok(!csv.includes('author')); assert.ok(!csv.includes('FACILITY'));
});
test('admin updates status and history, rejects stale version, removes resolved marker', async () => {
  const row = seed(); const payload = { status: 'RESOLVED', version: 1, publicNote: '보수 확인', note: '현장 확인 후 처리' };
  const patch = () => request(`/admin/hazards/${row.id}`, 'admin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal((await patch()).status, 200); assert.equal(row.version, 2); assert.equal(history[0].adminId, 'admin');
  assert.equal((await patch()).status, 409); assert.equal(history.length, 1);
  assert.equal((await (await request(`/hazards?courseId=${course.id}`)).json()).total, 0);
});
test('oversized uploads and repeated upload attempts are limited', async () => {
  assert.equal((await submit(form({}, Buffer.alloc(5 * 1024 * 1024 + 1)))).status, 400);
  for (let n = 0; n < 10; n++) assert.equal((await submit(form({ consent: 'false' }), 'rate-user')).status, 400);
  assert.equal((await submit(form(), 'rate-user')).status, 429);
});
