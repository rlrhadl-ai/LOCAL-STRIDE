import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { broadcastRanking, rankingFor } from '../live/ranking';

export const events = Router();

// GET /api/events
events.get('/events', wrap(async (req, res) => {
  const rows = await prisma.event.findMany({ where: { kind: 'RACE', status: { in: ['OPEN', 'CLOSED', 'FINISHED'] } }, orderBy: { startsAt: 'asc' }, include: { course: { select: { name: true, distanceM: true } }, _count: { select: { registrations: true } } } });
  const mine = req.user ? new Set((await prisma.eventRegistration.findMany({ where: { userId: req.user.id } })).map((r) => r.eventId)) : new Set<string>();
  res.json({ items: rows.map((e) => ({ ...e, registered: mine.has(e.id) })) });
}));

// GET /api/events/:idOrSlug
events.get('/events/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  const ev = await prisma.event.findFirst({ where: { OR: [{ id }, { slug: id }], kind: 'RACE' }, include: { course: true, _count: { select: { registrations: true } } } });
  if (!ev) throw new HttpError(404, '대회가 없습니다');
  const reg = req.user ? await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: ev.id, userId: req.user.id } } }) : null;
  res.json({ ...ev, registration: reg, ranking: await rankingFor(ev.id) });
}));

// POST /api/events/:id/register { tshirtSize? } — 결제는 2단계(토스) — 지금은 무료/후불 처리
events.post('/events/:id/register', requireUser, wrap(async (req, res) => {
  const body = z.object({ tshirtSize: z.enum(['S', 'M', 'L', 'XL', '2XL']).optional() }).parse(req.body ?? {});
  const ev = await prisma.event.findUnique({ where: { id: String(req.params.id) }, include: { _count: { select: { registrations: { where: { status: { in: ['REGISTERED', 'ATTENDED'] } } } } } } });
  if (!ev || ev.status !== 'OPEN') throw new HttpError(409, '접수 중인 대회가 아닙니다');
  if (ev._count.registrations >= ev.capacity) throw new HttpError(409, '정원이 마감되었습니다');
  const reg = await prisma.eventRegistration.upsert({ where: { eventId_userId: { eventId: ev.id, userId: req.user!.id } }, create: { eventId: ev.id, userId: req.user!.id, tshirtSize: body.tshirtSize, bib: ev._count.registrations + 1, paid: ev.feeKrw === 0, status: 'REGISTERED' }, update: { tshirtSize: body.tshirtSize, status: 'REGISTERED' } });
  res.status(201).json(reg);
}));

// POST /api/events/:id/results { timeSec, distanceM } — 라이브 랭킹 갱신(본인 기록). 운영자용 일괄 입력은 2단계
events.post('/events/:id/results', requireUser, wrap(async (req, res) => {
  const body = z.object({ timeSec: z.number().min(1), distanceM: z.number().min(0) }).parse(req.body);
  const reg = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: String(req.params.id), userId: req.user!.id } } });
  if (!reg) throw new HttpError(403, '참가 등록이 필요합니다');
  const r = await prisma.eventResult.upsert({ where: { eventId_userId: { eventId: reg.eventId, userId: req.user!.id } }, create: { eventId: reg.eventId, userId: req.user!.id, timeSec: body.timeSec, distanceM: body.distanceM }, update: { timeSec: body.timeSec, distanceM: body.distanceM } });
  await broadcastRanking(reg.eventId);
  res.json(r);
}));

// GET /api/events/:id/ranking — 폴링 폴백 (소켓 미지원 환경)
events.get('/events/:id/ranking', wrap(async (req, res) => { res.json({ items: await rankingFor(String(req.params.id)) }); }));
