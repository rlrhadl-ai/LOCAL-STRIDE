import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';

export const me = Router();
me.use('/me', requireUser);

// GET /api/me — 프로필 + 통계 + 쿠폰 + 메달
me.get('/me', wrap(async (req, res) => {
  const uid = req.user!.id;
  const demoCoupon = await prisma.coupon.findFirst({ where: { title: '러너스데이 완주 리커버리 5,000원 데모 쿠폰', validUntil: { gte: new Date() } }, select: { id: true } });
  if (demoCoupon) {
    const demoCode = `DEMO-RD-${createHash('sha256').update(uid).digest('hex').slice(0, 8).toUpperCase()}`;
    await prisma.userCoupon.upsert({ where: { code: demoCode }, create: { userId: uid, couponId: demoCoupon.id, code: demoCode }, update: {} });
  }
  const [user, agg, courses, medals, coupons, challenges, crews] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { id: true, email: true, role: true, nickname: true, avatarColor: true, avatarUrl: true, bio: true, homeArea: true, weeklyGoalKm: true, preferredPaceSec: true, phoneVerified: true, kakaoId: true, createdAt: true } }),
    prisma.run.aggregate({ _sum: { distanceM: true, durationSec: true }, _count: { _all: true }, where: { userId: uid, status: 'FINISHED', valid: true } }),
    prisma.run.groupBy({ by: ['courseId'], where: { userId: uid, status: 'FINISHED', valid: true } }),
    prisma.userMedal.findMany({ where: { userId: uid }, include: { medal: true }, orderBy: { earnedAt: 'desc' } }),
    prisma.userCoupon.findMany({ where: { userId: uid }, include: { coupon: { include: { merchant: true } } }, orderBy: { issuedAt: 'desc' } }),
    prisma.userChallenge.findMany({ where: { userId: uid }, include: { challenge: true } }),
    prisma.crewMember.findMany({ where: { userId: uid }, include: { crew: { select: { id: true, name: true } } } }),
  ]);
  const totalKm = Math.round(((agg._sum.distanceM ?? 0) / 1000) * 10) / 10;
  const level = Math.max(1, Math.floor(totalKm / 20) + 1);
  res.json({ user: user ? { ...user, isAuthenticated: Boolean(req.user?.isAuthenticated) } : null, stats: { totalKm, runs: agg._count._all, courses: courses.length, medals: medals.length, level, levelName: level >= 7 ? '로컬 러너' : level >= 3 ? '동네 러너' : '새싹 러너' }, medals, coupons, challenges, crews: crews.map((c) => c.crew) });
}));

// PATCH /api/me — 공개 프로필과 러닝 선호 정보
me.patch('/me', wrap(async (req, res) => {
  const body = z.object({
    nickname: z.string().trim().min(2).max(16).optional(),
    avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    avatarUrl: z.string().max(1000).refine((value) => !value || value.startsWith('/') || /^https?:\/\//i.test(value), '프로필 이미지 URL 형식을 확인해 주세요').nullable().optional(),
    bio: z.string().trim().max(160).nullable().optional(),
    homeArea: z.string().trim().min(2).max(40).optional(),
    weeklyGoalKm: z.number().int().min(1).max(500).optional(),
    preferredPaceSec: z.number().int().min(180).max(900).nullable().optional(),
  }).parse(req.body);
  res.json(await prisma.user.update({ where: { id: req.user!.id }, data: body, select: { id: true, nickname: true, avatarColor: true, avatarUrl: true, bio: true, homeArea: true, weeklyGoalKm: true, preferredPaceSec: true } }));
}));

// GET /api/me/runs
me.get('/me/runs', wrap(async (req, res) => {
  res.json({ items: await prisma.run.findMany({ where: { userId: req.user!.id, status: 'FINISHED' }, orderBy: { finishedAt: 'desc' }, take: 30, include: { course: { select: { name: true, slug: true } } } }) });
}));

// POST /api/me/coupons/:code/use
me.post('/me/coupons/:code/use', wrap(async (req, res) => {
  const c = await prisma.userCoupon.findFirst({ where: { code: String(req.params.code), userId: req.user!.id } });
  if (!c) return res.status(404).json({ error: '쿠폰이 없습니다' });
  if (c.usedAt) return res.status(409).json({ error: '이미 사용한 쿠폰입니다' });
  res.json(await prisma.userCoupon.update({ where: { id: c.id }, data: { usedAt: new Date() } }));
}));
