/**
 * 완주 처리 — 검증 → 메달 → 쿠폰 → 챌린지 → 미션 진행 갱신
 */
import { prisma } from '../lib/prisma';
import { fmtPace } from '../lib/geo';

export interface FinishSummary {
  valid: boolean;
  invalidReason: string | null;
  distanceM: number;
  durationSec: number;
  avgPaceSec: number;
  pace: string;
  checkins: number;
  checkpoints: number;
  medal: { code: string; name: string; description: string; isNew: boolean } | null;
  coupon: { code: string; title: string; discountKrw: number; merchant: string; validUntil: string } | null;
  challenge: { code: string; name: string; before: number; after: number; target: number } | null;
  missions: { code: string; title: string; type: string; value: number; done: boolean }[];
  medalCollection: { code: string; name: string; earned: boolean; isNew: boolean }[];
  profile: { totalKm: number; courses: number; medals: number };
}

function validate(mode: 'DEMO' | 'LIVE', courseDistanceM: number, distanceM: number, durationSec: number, trackLen: number, allCheckedIn: boolean): string | null {
  if (mode !== 'LIVE') return '데모 러닝은 완주 인증 및 보상 대상이 아닙니다';
  const requiredDistanceM = Math.max(200, Math.round(courseDistanceM * 0.8));
  if (distanceM < requiredDistanceM) return `GPS 확인 거리 ${(distanceM / 1000).toFixed(2)}km — 최소 ${(requiredDistanceM / 1000).toFixed(2)}km가 필요합니다`;
  if (!allCheckedIn) return '모든 체크포인트를 GPS로 통과해야 완주할 수 있습니다';
  if (trackLen < Math.max(10, Math.ceil(courseDistanceM / 500))) return 'GPS 궤적이 부족합니다 — 위치 권한과 GPS 수신 상태를 확인해 주세요';
  const pace = durationSec / (distanceM / 1000);
  if (pace < 150) return `페이스 ${fmtPace(pace)} — 사람이 낼 수 없는 속도`;
  if (pace > 1500) return '페이스 25분/km 초과 — 러닝 기록으로 인증할 수 없습니다';
  return null;
}

export async function finishRun(runId: string, userId: string): Promise<FinishSummary> {
  const run = await prisma.run.findFirst({ where: { id: runId, userId }, include: { course: { include: { checkpoints: true } }, checkins: true } });
  if (!run) throw new Error('러닝을 찾을 수 없습니다');
  if (run.status === 'FINISHED') throw new Error('이미 완주 처리된 러닝입니다');
  const distanceM = run.distanceM;
  const durationSec = Math.max(1, Math.round((Date.now() - run.startedAt.getTime()) / 1000));
  const track = Array.isArray(run.track) ? (run.track as unknown[]) : [];
  const allCheckedIn = run.checkins.length >= run.course.checkpoints.length;
  const invalidReason = validate(run.mode, run.course.distanceM, distanceM, durationSec, track.length, allCheckedIn);
  if (invalidReason) throw new Error(invalidReason);
  const avgPaceSec = Math.round(durationSec / (distanceM / 1000));
  const valid = true;

  await prisma.run.update({ where: { id: run.id }, data: { status: 'FINISHED', finishedAt: new Date(), distanceM, durationSec, avgPaceSec, valid, invalidReason } });

  const summary: FinishSummary = {
    valid, invalidReason, distanceM, durationSec, avgPaceSec, pace: fmtPace(avgPaceSec), checkins: run.checkins.length, checkpoints: run.course.checkpoints.length,
    medal: null, coupon: null, challenge: null, missions: [], medalCollection: [], profile: { totalKm: 0, courses: 0, medals: 0 },
  };

  if (valid) {
    // 메달 (코스 완주 메달) — 체크인을 모두 채웠을 때만
    const medal = await prisma.medal.findFirst({ where: { courseSlug: run.course.slug } });
    if (medal && allCheckedIn) {
      const existing = await prisma.userMedal.findUnique({ where: { userId_medalId: { userId, medalId: medal.id } } });
      if (!existing) await prisma.userMedal.create({ data: { userId, medalId: medal.id, runId: run.id } });
      summary.medal = { code: medal.code, name: medal.name, description: medal.description, isNew: !existing };
    }
    // 쿠폰 (코스 연계 쿠폰 1장)
    const coupon = await prisma.coupon.findFirst({ where: { courseSlug: run.course.slug, validUntil: { gte: new Date() } }, include: { merchant: true } });
    if (coupon) {
      const code = `LS-${run.course.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      await prisma.userCoupon.create({ data: { userId, couponId: coupon.id, runId: run.id, code } });
      summary.coupon = { code, title: coupon.title, discountKrw: coupon.discountKrw, merchant: coupon.merchant.name, validUntil: coupon.validUntil.toISOString() };
    }
    // 챌린지 (대구 5대 코스 정복 등 — 코스 slug 가 포함된 챌린지)
    const challenges = await prisma.challenge.findMany({ where: { courseSlugs: { has: run.course.slug } } });
    for (const ch of challenges) {
      const uc = await prisma.userChallenge.upsert({ where: { userId_challengeId: { userId, challengeId: ch.id } }, create: { userId, challengeId: ch.id, completedSlugs: [] }, update: {} });
      const before = uc.completedSlugs.length;
      if (!uc.completedSlugs.includes(run.course.slug)) await prisma.userChallenge.update({ where: { id: uc.id }, data: { completedSlugs: { push: run.course.slug } } });
      summary.challenge = { code: ch.code, name: ch.name, before, after: uc.completedSlugs.includes(run.course.slug) ? before : before + 1, target: ch.targetCount };
    }
    // 미션 진행
    const now = new Date();
    const missions = await prisma.mission.findMany({ where: { periodStart: { lte: now }, periodEnd: { gte: now } } });
    for (const m of missions) {
      const rule = (m.rule ?? {}) as any;
      const prog = await prisma.missionProgress.upsert({ where: { userId_missionId: { userId, missionId: m.id } }, create: { userId, missionId: m.id }, update: {} });
      if (prog.done) { summary.missions.push({ code: m.code, title: m.title, type: m.type, value: prog.value, done: true }); continue; }
      let value = prog.value, done = false;
      if (m.type === 'PERIOD_DISTANCE') { value += distanceM; done = value >= (rule.targetM ?? 10000); }
      else if (m.type === 'MIRACLE_RUN') { const h = (run.startedAt.getUTCHours() + 9) % 24; if (h >= (rule.startHourFrom ?? 5) && h < (rule.startHourTo ?? 8)) value += 1; done = value >= (rule.count ?? 3); }
      else if (m.type === 'CHECKIN') { if (allCheckedIn && (!rule.courseSlug || rule.courseSlug === run.course.slug)) { value += 1; done = value >= (rule.count ?? 1); } }
      else continue; // LOCAL_FOOD / WORKOUT 은 별도 인증 API
      await prisma.missionProgress.update({ where: { id: prog.id }, data: { value, done } });
      summary.missions.push({ code: m.code, title: m.title, type: m.type, value, done });
    }
  }

  // 메달 컬렉션 + 프로필 요약
  const [allMedals, mine, agg, courseCount] = await Promise.all([
    prisma.medal.findMany({ orderBy: { code: 'asc' } }),
    prisma.userMedal.findMany({ where: { userId } }),
    prisma.run.aggregate({ _sum: { distanceM: true }, where: { userId, status: 'FINISHED', valid: true } }),
    prisma.run.groupBy({ by: ['courseId'], where: { userId, status: 'FINISHED', valid: true } }),
  ]);
  const mineIds = new Set(mine.map((m) => m.medalId));
  summary.medalCollection = allMedals.map((m) => ({ code: m.code, name: m.name, earned: mineIds.has(m.id), isNew: summary.medal?.code === m.code && summary.medal.isNew }));
  summary.profile = { totalKm: Math.round(((agg._sum.distanceM ?? 0) / 1000) * 10) / 10, courses: courseCount.length, medals: mine.length };
  return summary;
}
