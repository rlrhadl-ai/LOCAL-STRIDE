import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { haversine } from '../lib/geo';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { finishRun } from '../services/finish';

export const runs = Router();
runs.use('/runs', requireUser);

// POST /api/runs { courseId, mode }
runs.post('/runs', wrap(async (req, res) => {
  const body = z.object({ courseId: z.string(), mode: z.enum(['DEMO', 'LIVE']).default('DEMO') }).parse(req.body);
  const course = await prisma.course.findFirst({ where: { OR: [{ id: body.courseId }, { slug: body.courseId }] }, include: { checkpoints: { orderBy: { order: 'asc' } }, pois: { include: { poi: true }, orderBy: { distFromStartM: 'asc' } } } });
  if (!course) throw new HttpError(404, '코스를 찾을 수 없습니다');
  // 진행 중이던 러닝은 정리
  await prisma.run.updateMany({ where: { userId: req.user!.id, status: 'ACTIVE' }, data: { status: 'ABANDONED' } });
  const run = await prisma.run.create({ data: { userId: req.user!.id, courseId: course.id, mode: body.mode } });
  // 출발점 자동 체크인
  const start = course.checkpoints[0];
  if (start) await prisma.checkin.create({ data: { runId: run.id, checkpointId: start.id, lat: start.lat, lng: start.lng, method: body.mode === 'DEMO' ? 'DEMO' : 'GPS' } });
  res.status(201).json({ run, course });
}));

// GET /api/runs/:id
runs.get('/runs/:id', wrap(async (req, res) => {
  const run = await prisma.run.findFirst({ where: { id: String(req.params.id), userId: req.user!.id }, include: { course: { include: { checkpoints: { orderBy: { order: 'asc' } } } }, checkins: true, medals: { include: { medal: true } }, coupons: { include: { coupon: { include: { merchant: true } } } } } });
  if (!run) throw new HttpError(404, '러닝을 찾을 수 없습니다');
  res.json(run);
}));

// POST /api/runs/:id/track { points: [{lat,lng,t}] } — 궤적 추가 + 서버 거리 계산
runs.post('/runs/:id/track', wrap(async (req, res) => {
  const body = z.object({ points: z.array(z.object({ lat: z.number(), lng: z.number(), t: z.number() })).min(1).max(500) }).parse(req.body);
  const run = await prisma.run.findFirst({ where: { id: String(req.params.id), userId: req.user!.id, status: 'ACTIVE' } });
  if (!run) throw new HttpError(404, '진행 중인 러닝이 아닙니다');
  const track = (Array.isArray(run.track) ? (run.track as any[]) : []) as { lat: number; lng: number; t: number }[];
  let dist = run.distanceM;
  let prev = track[track.length - 1];
  for (const p of body.points) {
    if (prev) {
      const d = haversine([prev.lat, prev.lng], [p.lat, p.lng]);
      const dt = Math.max(1, (p.t - prev.t) / 1000);
      // 4m 미만 노이즈 무시, 25km/h(≈7m/s) 초과 점프 무시
      if (d >= 4 && d / dt <= 7) dist += d;
    }
    track.push(p); prev = p;
  }
  const trimmed = track.length > 5000 ? track.filter((_, i) => i % 2 === 0) : track;
  await prisma.run.update({ where: { id: run.id }, data: { track: trimmed, distanceM: Math.round(dist) } });
  res.json({ distanceM: Math.round(dist), points: trimmed.length });
}));

// POST /api/runs/:id/checkin { checkpointId, lat?, lng?, method? }
runs.post('/runs/:id/checkin', wrap(async (req, res) => {
  const body = z.object({ checkpointId: z.string(), lat: z.number().optional(), lng: z.number().optional(), method: z.enum(['GPS', 'QR', 'DEMO']).default('GPS') }).parse(req.body);
  const run = await prisma.run.findFirst({ where: { id: String(req.params.id), userId: req.user!.id, status: 'ACTIVE' }, include: { course: { include: { checkpoints: true } }, checkins: true } });
  if (!run) throw new HttpError(404, '진행 중인 러닝이 아닙니다');
  const cp = run.course.checkpoints.find((c) => c.id === body.checkpointId);
  if (!cp) throw new HttpError(404, '체크포인트가 코스에 없습니다');
  if (run.mode === 'LIVE' && body.method === 'GPS') {
    if (body.lat == null || body.lng == null) throw new HttpError(400, 'GPS 체크인은 좌표가 필요합니다');
    const d = haversine([body.lat, body.lng], [cp.lat, cp.lng]);
    if (d > cp.radiusM) throw new HttpError(409, `체크포인트까지 ${Math.round(d)}m — ${cp.radiusM}m 반경 밖`);
  }
  const checkin = await prisma.checkin.upsert({ where: { runId_checkpointId: { runId: run.id, checkpointId: cp.id } }, create: { runId: run.id, checkpointId: cp.id, lat: body.lat, lng: body.lng, method: run.mode === 'DEMO' ? 'DEMO' : body.method }, update: {} });
  const done = new Set(run.checkins.map((c) => c.checkpointId)); done.add(cp.id);
  res.json({ checkin, progress: { done: done.size, total: run.course.checkpoints.length }, reward: cp.reward });
}));

// POST /api/runs/:id/finish { durationSec, distanceM? }
runs.post('/runs/:id/finish', wrap(async (req, res) => {
  const body = z.object({ durationSec: z.number().min(1), distanceM: z.number().optional() }).parse(req.body);
  try {
    res.json(await finishRun(String(req.params.id), req.user!.id, body));
  } catch (e: any) { throw new HttpError(400, e.message); }
}));
