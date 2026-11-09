const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { analyzeMateRuns, buildMatePlan, DEFAULT_MATE_PREFERENCES: defaults, MATES, mateById, mateReply, paceLabel, paceStory, weatherStory, koreanDay } = require('../lib/ai-mate.ts');
const now = Date.parse('2026-11-09T01:00:00Z'), day = 86400000;
const profile = { id: 'runner-a', nickname: '러너', homeArea: '대구 수성구', weeklyGoalKm: 20, preferredPaceSec: 420 };
const run = (id, ago = 1, changes = {}) => ({ id, mode: 'LIVE', valid: true, status: 'FINISHED', startedAt: new Date(now - ago * day).toISOString(), finishedAt: new Date(now - ago * day + 1800000).toISOString(), distanceM: 5000, durationSec: 1800, avgPaceSec: 360, course: { name: '수성못 5K', slug: 'suseong' }, ...changes });
const course = (slug, km, changes = {}) => ({ id: slug, slug, name: slug, distanceM: km * 1000, elevationGainM: 10, areaName: '대구 수성구', themes: ['수변'], isPublic: true, difficulty: '초급', ...changes });

test('only the requested brown bear and squirrel are selectable', () => {
  assert.deepEqual(MATES.map(m => m.id), ['bori', 'daram']); assert.equal(mateById('obsolete').id, 'bori');
});
test('exclude demo, invalid, incomplete, future, old, zero-distance and abandoned runs', () => {
  const a = analyzeMateRuns([run('ok'), run('demo', 1, { mode: 'DEMO' }), run('invalid', 1, { valid: false }), run('active', 1, { finishedAt: null }), run('future', -1), run('old', 29), run('zero', 1, { distanceM: 0 }), run('abandoned', 1, { status: 'ABANDONED' })], now);
  assert.deepEqual(a.recent.map(r => r.id), ['ok']); assert.equal(a.totalKm, 5);
});
test('pace uses observed duration and distance, not a stale average field', () => {
  const a = analyzeMateRuns([run('1', 1, { avgPaceSec: 100 }), run('2', 2, { durationSec: 2100 }), run('3', 3, { durationSec: 2400 })], now);
  assert.equal(a.paceSec, 420); assert.equal(a.paceSamples, 3);
});
test('empty history does not fabricate performance', () => {
  const a = analyzeMateRuns([], now); assert.equal(a.paceSec, null); assert.equal(a.comparison, null); assert.match(paceStory(a), /아직 분석할 실제 완주 기록이 없어요/);
});
test('seven-day and previous-week totals stay separate', () => {
  const a = analyzeMateRuns([run('now', 1), run('last', 8, { distanceM: 3000 }), run('older', 15)], now);
  assert.equal(a.weekKm, 5); assert.equal(a.previousKm, 3); assert.equal(a.weekRuns, 1);
});
test('compare only with at least two same-course similar-distance records', () => {
  const runs = [run('new', 1, { durationSec: 1700 }), run('old1', 2), run('old2', 3, { durationSec: 1900 }), run('other', 4, { course: { name: '다른 코스', slug: 'other' }, durationSec: 3000 })];
  const a = analyzeMateRuns(runs, now); assert.equal(a.comparison.count, 2); assert.equal(a.comparison.delta, -30); assert.equal(analyzeMateRuns(runs.slice(0, 2), now).comparison, null);
});
test('recommend only public courses within the available time', () => {
  const p = buildMatePlan(analyzeMateRuns([], now), [course('short', 3), course('long', 5), course('private', 2, { isPublic: false })], defaults, profile, '수성구');
  assert.deepEqual(p.routes.map(r => r.course.id), ['short']); assert.ok(p.routes.every(r => r.minutes <= 30));
});
test('a 10k goal does not immediately recommend 10k to a new runner', () => {
  const p = buildMatePlan(analyzeMateRuns([], now), [course('short', 3), course('ten', 10)], { ...defaults, goal: '10k', minutes: 60 }, profile, '수성구'); assert.deepEqual(p.routes.map(r => r.course.id), ['short']);
});
test('hard feedback filters long and steep courses', () => {
  const p = buildMatePlan(analyzeMateRuns([run('latest')], now), [course('flat', 3), course('steep', 3, { elevationGainM: 200 }), course('long', 5.5)], { ...defaults, minutes: 60 }, profile, '수성구', { latest: { effort: 'hard', liked: null } });
  assert.equal(p.gentle, true); assert.deepEqual(p.routes.map(r => r.course.id), ['flat']);
});
test('course dislikes change ranking without changing measured history', () => {
  const a = analyzeMateRuns([run('latest', 1, { course: { name: 'a', slug: 'a' } })], now);
  const p = buildMatePlan(a, [course('a', 4), course('b', 4)], { ...defaults, minutes: 60 }, profile, '수성구', { latest: { effort: 'right', liked: false } });
  assert.equal(p.routes[0].course.id, 'b'); assert.equal(a.count, 1);
});
test('other-area courses are explicitly labelled as alternatives', () => {
  const p = buildMatePlan(analyzeMateRuns([], now), [course('river', 3)], defaults, profile, '군위군'); assert.equal(p.routes[0].local, false); assert.match(p.routes[0].reasons[0], /대안 코스/);
});
test('stored weather and air quality are not described as live', () => {
  assert.match(weatherStory({ source: 'DEMO', airSource: 'DEMO' }), /저장된 참고 정보/);
  assert.doesNotMatch(weatherStory({ source: 'KMA', airSource: 'DEMO', temp: 10, sky: '맑음', rainType: '없음', pm10Grade: '좋음' }), /미세먼지 좋음/);
});
test('fallback identifies its limits and does not diagnose pain', () => {
  const a = analyzeMateRuns([], now), p = buildMatePlan(a, [], defaults, profile, '수성구');
  assert.match(mateReply('내일 주가 알려줘', 'daram', a, p), /기록 기반 안내/); assert.match(mateReply('무릎 통증 진단해줘', 'bori', a, p), /판단할 수 없어요/);
});
test('pace seconds carry correctly and daily conditions use Korean dates', () => {
  assert.equal(paceLabel(359.8), '6′00″'); assert.equal(paceLabel(null), '아직 없어요'); assert.equal(koreanDay(new Date('2026-11-08T16:00:00Z')), '2026-11-09');
});
