import { Router } from 'express';
import type { RegistrationStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAccount } from '../middleware/auth';
import { HttpError, wrap } from '../middleware/error';

export const programs = Router();
const activeRegistration: RegistrationStatus[] = ['REGISTERED', 'ATTENDED'];
const publicKinds = ['MORNING', 'AFTER_WORK', 'INDEPENDENT', 'THEME', 'POPUP'] as const;
const registrationEnabled = process.env.ALLOW_PROGRAM_REGISTRATION === 'true';

const hostSelect = {
  id: true, nickname: true, avatarColor: true, avatarUrl: true, bio: true,
  homeArea: true, preferredPaceSec: true, phoneVerified: true,
  _count: { select: { runs: true } },
} as const;

function present(row: any, userId?: string) {
  const active = row.registrations.filter((registration: any) => activeRegistration.includes(registration.status));
  const mine = userId ? row.registrations.find((registration: any) => registration.userId === userId) : null;
  return {
    id: row.id, slug: row.slug, title: row.title, description: row.description, kind: row.kind,
    place: row.place, paceSec: row.paceSec, imageUrl: row.imageUrl, startsAt: row.startsAt,
    capacity: row.capacity, remaining: Math.max(0, row.capacity - active.length), feeKrw: row.feeKrw,
    status: row.status, registered: Boolean(mine && activeRegistration.includes(mine.status)),
    registrationStatus: mine?.status ?? null, registrationEnabled,
    host: row.host ? { ...row.host, runCount: row.host._count.runs, _count: undefined } : null,
    course: row.course,
  };
}

programs.get('/programs', wrap(async (req, res) => {
  const query = z.object({ limit: z.coerce.number().int().min(1).max(20).default(12) }).parse(req.query);
  const rows = await prisma.event.findMany({
    where: { kind: { in: [...publicKinds] }, status: 'OPEN', startsAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    orderBy: { startsAt: 'asc' }, take: query.limit,
    include: {
      host: { select: hostSelect },
      course: { select: { id: true, slug: true, name: true, distanceM: true, difficulty: true, thumbnailUrl: true } },
      registrations: { select: { userId: true, status: true } },
    },
  });
  res.json({ items: rows.map((row) => present(row, req.user?.isAuthenticated ? req.user.id : undefined)) });
}));
programs.get('/programs/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  const row = await prisma.event.findFirst({
    where: { OR: [{ id }, { slug: id }], kind: { in: [...publicKinds] } },
    include: { host: { select: hostSelect }, course: true, registrations: { select: { userId: true, status: true } } },
  });
  if (!row) throw new HttpError(404, '러닝 프로그램을 찾을 수 없습니다');
  res.json(present(row, req.user?.isAuthenticated ? req.user.id : undefined));
}));

programs.post('/programs/:id/join', requireAccount, wrap(async (req, res) => {
  if (!registrationEnabled) throw new HttpError(409, '현재 일정은 MVP 시범 콘텐츠로 실제 참가 신청을 받지 않습니다');
  const id = String(req.params.id);
  const registration = await prisma.$transaction(async (tx) => {
    const program = await tx.event.findFirst({ where: { OR: [{ id }, { slug: id }], kind: { in: [...publicKinds] } } });
    if (!program || program.status !== 'OPEN' || program.startsAt <= new Date()) throw new HttpError(409, '현재 신청할 수 없는 러닝 프로그램입니다');
    const existing = await tx.eventRegistration.findUnique({ where: { eventId_userId: { eventId: program.id, userId: req.user!.id } } });
    if (existing && activeRegistration.includes(existing.status)) return existing;
    const count = await tx.eventRegistration.count({ where: { eventId: program.id, status: { in: [...activeRegistration] } } });
    if (count >= program.capacity) throw new HttpError(409, '모집 인원이 마감되었습니다');
    return tx.eventRegistration.upsert({
      where: { eventId_userId: { eventId: program.id, userId: req.user!.id } },
      create: { eventId: program.id, userId: req.user!.id, paid: program.feeKrw === 0, status: 'REGISTERED' },
      update: { status: 'REGISTERED', checkedInAt: null },
    });
  });
  res.status(201).json({ registration });
}));

programs.post('/programs/:id/cancel', requireAccount, wrap(async (req, res) => {
  if (!registrationEnabled) throw new HttpError(409, '현재 일정은 MVP 시범 콘텐츠입니다');
  const id = String(req.params.id);
  const program = await prisma.event.findFirst({ where: { OR: [{ id }, { slug: id }], kind: { in: [...publicKinds] } }, select: { id: true, startsAt: true } });
  if (!program) throw new HttpError(404, '러닝 프로그램을 찾을 수 없습니다');
  if (program.startsAt <= new Date()) throw new HttpError(409, '시작된 프로그램은 취소할 수 없습니다');
  const result = await prisma.eventRegistration.updateMany({ where: { eventId: program.id, userId: req.user!.id }, data: { status: 'CANCELLED', checkedInAt: null } });
  if (!result.count) throw new HttpError(404, '참가 신청 내역이 없습니다');
  res.json({ canceled: true });
}));
