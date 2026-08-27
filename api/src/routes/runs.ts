import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { haversine } from '../lib/geo';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { finishRun } from '../services/finish';

export const runs = Router();
runs.use('/runs', requireUser);

const MAX_GPS_ACCURACY_M = 80;
const MAX_GPS_POINT_AGE_MS = 2 * 60 * 1000;
const MAX_BUFFERED_GPS_POINT_AGE_MS = 12 * 60 * 60 * 1000;
const gpsPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  t: z.number().int().positive(),
  accuracy: z.number().min(0).max(1000).optional(),
});

type GpsPoint = z.infer<typeof gpsPoint>;

function assertFreshAccurateFix(point: GpsPoint) {
  if ((point.accuracy ?? Infinity) > MAX_GPS_ACCURACY_M) {
    throw new HttpError(422, `GPS 정확도가 낮습니다 (±${Math.round(point.accuracy ?? 0)}m) — 탁 트인 곳에서 다시 시도해 주세요`);
  }
  if (Math.abs(Date.now() - point.t) > MAX_GPS_POINT_AGE_MS) {
    throw new HttpError(422, '오래된 GPS 위치입니다 — 위치를 새로 확인해 주세요');
  }
}

// POST /api/runs { courseId, mode, start? } — LIVE는 출발점 GPS 인증 필수
runs.post('/runs', wrap(async (req, res) => {
  const body = z.object({ courseId: z.string(), mode: z.enum(['DEMO', 'LIVE']).default('LIVE'), start: gpsPoint.optional() }).parse(req.body);
  if (body.mode === 'DEMO' && process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_RUNS !== 'true') {
    throw new HttpError(403, '운영 환경에서는 실제 GPS 러닝만 시작할 수 있습니다');
  }
  const course = await prisma.course.findFirst({ where: { OR: [{ id: body.courseId }, { slug: body.courseId }] }, include: { checkpoints: { orderBy: { order: 'asc' } }, pois: { include: { poi: true }, orderBy: { distFromStartM: 'asc' } } } });
  if (!course) throw new HttpError(404, '코스를 찾을 수 없습니다');
  const start = course.checkpoints[0];
  if (!start) throw new HttpError(409, '출발 체크포인트가 없는 코스입니다');

  if (body.mode === 'LIVE') {
    if (!body.start) throw new HttpError(400, '러닝 시작을 위한 GPS 위치가 필요합니다');
    assertFreshAccurateFix(body.start);
    const distanceToStart = haversine([body.start.lat, body.start.lng], [start.lat, start.lng]);
    const allowedRadius = start.radiusM + Math.min(body.start.accuracy ?? 0, 30);
    if (distanceToStart > allowedRadius) {
      throw new HttpError(409, `출발점까지 ${Math.round(distanceToStart)}m 남았습니다 — 출발점 반경 ${Math.round(allowedRadius)}m 안에서 시작해 주세요`);
    }
  }

  const initialFix = body.mode === 'LIVE' ? body.start! : { lat: start.lat, lng: start.lng, t: Date.now(), accuracy: 0 };
  const run = await prisma.$transaction(async (tx) => {
    await tx.run.updateMany({ where: { userId: req.user!.id, status: 'ACTIVE' }, data: { status: 'ABANDONED' } });
    return tx.run.create({
      data: {
        userId: req.user!.id,
        courseId: course.id,
        mode: body.mode,
        track: [initialFix],
        checkins: { create: { checkpointId: start.id, lat: initialFix.lat, lng: initialFix.lng, method: body.mode === 'DEMO' ? 'DEMO' : 'GPS' } },
      },
    });
  });
  res.status(201).json({ run, course });
}));

// GET /api/runs/active?courseId=:idOrSlug — 새로고침/앱 복귀 시 진행 중 러닝 복구
runs.get('/runs/active', wrap(async (req, res) => {
  const courseId = z.string().optional().parse(req.query.courseId);
  const active = await prisma.run.findFirst({
    where: {
      userId: req.user!.id,
      status: 'ACTIVE',
      startedAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      ...(courseId ? { course: { OR: [{ id: courseId }, { slug: courseId }] } } : {}),
    },
    orderBy: { startedAt: 'desc' },
    include: {
      course: {
        include: {
          checkpoints: { orderBy: { order: 'asc' } },
          pois: { include: { poi: true }, orderBy: { distFromStartM: 'asc' } },
        },
      },
      checkins: true,
    },
  });
  res.json(active);
}));

// GET /api/runs/:id
runs.get('/runs/:id', wrap(async (req, res) => {
  const run = await prisma.run.findFirst({ where: { id: String(req.params.id), userId: req.user!.id }, include: { course: { include: { checkpoints: { orderBy: { order: 'asc' } } } }, checkins: true, medals: { include: { medal: true } }, coupons: { include: { coupon: { include: { merchant: true } } } } } });
  if (!run) throw new HttpError(404, '러닝을 찾을 수 없습니다');
  res.json(run);
}));

// POST /api/runs/:id/track { points: [{lat,lng,t}] } — 궤적 추가 + 서버 거리 계산
runs.post('/runs/:id/track', wrap(async (req, res) => {
  const body = z.object({ points: z.array(gpsPoint).min(1).max(500) }).parse(req.body);
  const run = await prisma.run.findFirst({ where: { id: String(req.params.id), userId: req.user!.id, status: 'ACTIVE' } });
  if (!run) throw new HttpError(404, '진행 중인 러닝이 아닙니다');
  const track = (Array.isArray(run.track) ? (run.track as GpsPoint[]) : []);
  let dist = run.distanceM;
  let prev = track[track.length - 1];
  for (const p of body.points) {
    if (run.mode === 'LIVE') {
      if ((p.accuracy ?? Infinity) > MAX_GPS_ACCURACY_M) continue;
      if (p.t < run.startedAt.getTime() - MAX_GPS_POINT_AGE_MS || p.t > Date.now() + MAX_GPS_POINT_AGE_MS || Date.now() - p.t > MAX_BUFFERED_GPS_POINT_AGE_MS) continue;
    }
    if (!prev) { track.push(p); prev = p; continue; }
    const dt = (p.t - prev.t) / 1000;
    if (dt <= 0) continue;
    const d = haversine([prev.lat, prev.lng], [p.lat, p.lng]);
    // 4m 미만 노이즈와 25km/h(약 7m/s) 초과 순간 이동은 서버에서 제외
    if (d < 4 || d / dt > 7) continue;
    dist += d;
    track.push(p);
    prev = p;
  }
  const trimmed = track.length > 5000 ? track.filter((_, i) => i % 2 === 0) : track;
  await prisma.run.update({ where: { id: run.id }, data: { track: trimmed, distanceM: Math.round(dist) } });
  res.json({ distanceM: Math.round(dist), points: trimmed.length });
}));

// POST /api/runs/:id/checkin { checkpointId, lat?, lng?, method? }
runs.post('/runs/:id/checkin', wrap(async (req, res) => {
  const body = z.object({ checkpointId: z.string(), lat: z.number().optional(), lng: z.number().optional(), t: z.number().int().positive().optional(), accuracy: z.number().min(0).max(1000).optional(), method: z.enum(['GPS', 'QR', 'DEMO']).default('GPS') }).parse(req.body);
  const run = await prisma.run.findFirst({ where: { id: String(req.params.id), userId: req.user!.id, status: 'ACTIVE' }, include: { course: { include: { checkpoints: true } }, checkins: true } });
  if (!run) throw new HttpError(404, '진행 중인 러닝이 아닙니다');
  const checkpoints = [...run.course.checkpoints].sort((a, b) => a.order - b.order);
  const cp = checkpoints.find((c) => c.id === body.checkpointId);
  if (!cp) throw new HttpError(404, '체크포인트가 코스에 없습니다');
  const completed = new Set(run.checkins.map((c) => c.checkpointId));
  const expected = checkpoints.find((c) => !completed.has(c.id));
  if (completed.has(cp.id)) return res.json({ checkin: run.checkins.find((c) => c.checkpointId === cp.id), progress: { done: completed.size, total: checkpoints.length }, reward: cp.reward });
  if (expected?.id !== cp.id) throw new HttpError(409, `다음 체크포인트 '${expected?.name ?? '-'}'를 먼저 통과해 주세요`);

  let proof: GpsPoint | null = body.lat != null && body.lng != null ? { lat: body.lat, lng: body.lng, t: body.t ?? Date.now(), accuracy: body.accuracy } : null;
  if (run.mode === 'LIVE') {
    if (body.method !== 'GPS') throw new HttpError(400, '실제 러닝은 GPS 체크인만 허용됩니다');
    const track = (Array.isArray(run.track) ? run.track as GpsPoint[] : []);
    const proofTime = body.t ?? Date.now();
    proof = [...track].reverse().find((p) => {
      if ((p.accuracy ?? Infinity) > MAX_GPS_ACCURACY_M) return false;
      if (p.t < run.startedAt.getTime() - MAX_GPS_POINT_AGE_MS || p.t > Date.now() + MAX_GPS_POINT_AGE_MS || Date.now() - p.t > MAX_BUFFERED_GPS_POINT_AGE_MS) return false;
      if (Math.abs(p.t - proofTime) > MAX_GPS_POINT_AGE_MS) return false;
      return haversine([p.lat, p.lng], [cp.lat, cp.lng]) <= cp.radiusM + Math.min(p.accuracy ?? 0, 30);
    }) ?? null;
    if (!proof) throw new HttpError(409, `GPS 궤적에서 '${cp.name}' 반경 통과가 확인되지 않았습니다`);
  }
  const checkin = await prisma.checkin.upsert({ where: { runId_checkpointId: { runId: run.id, checkpointId: cp.id } }, create: { runId: run.id, checkpointId: cp.id, lat: proof?.lat, lng: proof?.lng, method: run.mode === 'DEMO' ? 'DEMO' : 'GPS' }, update: {} });
  const done = new Set(completed); done.add(cp.id);
  res.json({ checkin, progress: { done: done.size, total: run.course.checkpoints.length }, reward: cp.reward });
}));

// POST /api/runs/:id/finish { durationSec, distanceM? }
runs.post('/runs/:id/finish', wrap(async (req, res) => {
  z.object({ durationSec: z.number().min(1).optional(), distanceM: z.number().optional() }).parse(req.body);
  try {
    res.json(await finishRun(String(req.params.id), req.user!.id));
  } catch (e: any) { throw new HttpError(400, e.message); }
}));
