import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';

export const crews = Router();

// GET /api/crews?lifestyle=아침&pace=400
crews.get('/crews', wrap(async (req, res) => {
  const q = z.object({ lifestyle: z.string().optional(), pace: z.coerce.number().optional() }).parse(req.query);
  const where: any = {};
  if (q.lifestyle) where.lifestyle = { has: q.lifestyle };
  if (q.pace) { where.paceMinSec = { lte: q.pace }; where.paceMaxSec = { gte: q.pace }; }
  const rows = await prisma.crew.findMany({ where, include: { _count: { select: { members: true } }, owner: { select: { nickname: true } }, runs: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 1, include: { course: { select: { name: true } } } } }, orderBy: { createdAt: 'desc' } });
  const myIds = req.user ? new Set((await prisma.crewMember.findMany({ where: { userId: req.user.id } })).map((m) => m.crewId)) : new Set<string>();
  res.json({ items: rows.map((c) => ({ ...c, joined: myIds.has(c.id) })) });
}));

// POST /api/crews
crews.post('/crews', requireUser, wrap(async (req, res) => {
  const body = z.object({ name: z.string().min(2).max(30), description: z.string().max(300).default(''), lifestyle: z.array(z.string()).min(1).max(5), paceMinSec: z.number().min(150).max(1200), paceMaxSec: z.number().min(150).max(1500), area: z.string().default('대구 수성구'), openChatUrl: z.string().url().optional() }).parse(req.body);
  if (body.paceMinSec > body.paceMaxSec) throw new HttpError(400, '페이스 범위가 잘못되었습니다');
  const crew = await prisma.crew.create({ data: { ...body, ownerId: req.user!.id, members: { create: { userId: req.user!.id, role: 'OWNER' } } } });
  res.status(201).json(crew);
}));

// GET /api/crews/:id
crews.get('/crews/:id', wrap(async (req, res) => {
  const crew = await prisma.crew.findUnique({ where: { id: String(req.params.id) }, include: { owner: { select: { nickname: true, avatarColor: true } }, members: { include: { user: { select: { id: true, nickname: true, avatarColor: true } } } }, runs: { orderBy: { startsAt: 'asc' }, include: { course: { select: { id: true, slug: true, name: true, distanceM: true } } } } } });
  if (!crew) throw new HttpError(404, '크루가 없습니다');
  res.json({ ...crew, joined: Boolean(req.user && crew.members.some((m) => m.userId === req.user!.id)) });
}));

// POST /api/crews/:id/join | /leave
crews.post('/crews/:id/join', requireUser, wrap(async (req, res) => {
  const m = await prisma.crewMember.upsert({ where: { crewId_userId: { crewId: String(req.params.id), userId: req.user!.id } }, create: { crewId: String(req.params.id), userId: req.user!.id }, update: {} });
  res.json(m);
}));
crews.post('/crews/:id/leave', requireUser, wrap(async (req, res) => {
  await prisma.crewMember.deleteMany({ where: { crewId: String(req.params.id), userId: req.user!.id, role: 'MEMBER' } });
  res.json({ ok: true });
}));

// POST /api/crews/:id/runs { courseId?, startsAt, note? } — 정기 러닝 일정
crews.post('/crews/:id/runs', requireUser, wrap(async (req, res) => {
  const body = z.object({ courseId: z.string().optional(), startsAt: z.coerce.date(), note: z.string().max(200).optional() }).parse(req.body);
  const member = await prisma.crewMember.findUnique({ where: { crewId_userId: { crewId: String(req.params.id), userId: req.user!.id } } });
  if (!member) throw new HttpError(403, '크루 멤버만 일정을 만들 수 있어요');
  res.status(201).json(await prisma.crewRun.create({ data: { crewId: String(req.params.id), courseId: body.courseId, startsAt: body.startsAt, note: body.note } }));
}));
