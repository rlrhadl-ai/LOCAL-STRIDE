import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { wrap } from '../middleware/error';

export const rankings = Router();

/**
 * GET /api/rankings?period=week&courseId=
 * - 거리 랭킹: 기간 내 valid 완주 거리 합
 * - 코스 베스트: 해당 코스 최단 시간 (GPS 이상치는 finish 단계에서 valid=false 로 걸러짐)
 */
rankings.get('/rankings', wrap(async (req, res) => {
  const q = z.object({ period: z.enum(['week', 'month', 'all']).default('week'), courseId: z.string().optional() }).parse(req.query);
  const since = q.period === 'week' ? new Date(Date.now() - 7 * 86400000) : q.period === 'month' ? new Date(Date.now() - 30 * 86400000) : new Date(0);
  const dist = await prisma.run.groupBy({ by: ['userId'], where: { status: 'FINISHED', valid: true, finishedAt: { gte: since } }, _sum: { distanceM: true }, _count: { _all: true }, orderBy: { _sum: { distanceM: 'desc' } }, take: 50 });
  const users = await prisma.user.findMany({ where: { id: { in: dist.map((d) => d.userId) } }, select: { id: true, nickname: true, avatarColor: true } });
  const byId = new Map(users.map((u) => [u.id, u]));
  const distance = dist.map((d, i) => ({ rank: i + 1, userId: d.userId, nickname: byId.get(d.userId)?.nickname ?? '러너', avatarColor: byId.get(d.userId)?.avatarColor ?? '#1B5BDF', distanceM: d._sum.distanceM ?? 0, runs: d._count._all, isMe: req.user?.id === d.userId }));

  let courseBest: any[] = [];
  if (q.courseId) {
    const best = await prisma.run.findMany({ where: { courseId: q.courseId, status: 'FINISHED', valid: true }, orderBy: { durationSec: 'asc' }, distinct: ['userId'], take: 50, include: { user: { select: { nickname: true, avatarColor: true } } } });
    courseBest = best.map((r, i) => ({ rank: i + 1, nickname: r.user.nickname, avatarColor: r.user.avatarColor, durationSec: r.durationSec, avgPaceSec: r.avgPaceSec, finishedAt: r.finishedAt, isMe: req.user?.id === r.userId }));
  }
  res.json({ period: q.period, since, distance, courseBest });
}));
