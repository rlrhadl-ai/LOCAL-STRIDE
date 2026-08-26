import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';

export const mates = Router();

// GET /api/mates?type=PACEMAKER
mates.get('/mates', wrap(async (req, res) => {
  const q = z.object({ type: z.enum(['PACEMAKER', 'MATE']).optional() }).parse(req.query);
  const rows = await prisma.matePost.findMany({ where: { status: 'OPEN', meetAt: { gte: new Date(Date.now() - 86400000) }, ...(q.type ? { type: q.type } : {}) }, orderBy: { meetAt: 'asc' }, include: { author: { select: { nickname: true, avatarColor: true } }, _count: { select: { applications: true } } } });
  const mine = req.user ? new Set((await prisma.mateApplication.findMany({ where: { userId: req.user.id } })).map((a) => a.postId)) : new Set<string>();
  res.json({ items: rows.map((p) => ({ ...p, applied: mine.has(p.id), isMine: req.user?.id === p.authorId })) });
}));

// POST /api/mates
mates.post('/mates', requireUser, wrap(async (req, res) => {
  const body = z.object({ type: z.enum(['PACEMAKER', 'MATE']), paceSec: z.number().min(150).max(1500), meetAt: z.coerce.date(), place: z.string().min(2).max(60), slots: z.number().min(1).max(30).default(4), body: z.string().max(400).default('') }).parse(req.body);
  res.status(201).json(await prisma.matePost.create({ data: { ...body, authorId: req.user!.id } }));
}));

// POST /api/mates/:id/apply
mates.post('/mates/:id/apply', requireUser, wrap(async (req, res) => {
  const post = await prisma.matePost.findUnique({ where: { id: String(req.params.id) }, include: { _count: { select: { applications: true } } } });
  if (!post || post.status !== 'OPEN') throw new HttpError(409, '모집이 끝난 글입니다');
  if (post.authorId === req.user!.id) throw new HttpError(400, '내 글에는 신청할 수 없어요');
  if (post._count.applications >= post.slots) throw new HttpError(409, '정원이 찼습니다');
  res.status(201).json(await prisma.mateApplication.upsert({ where: { postId_userId: { postId: post.id, userId: req.user!.id } }, create: { postId: post.id, userId: req.user!.id }, update: {} }));
}));
