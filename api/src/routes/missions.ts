import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { haversine } from '../lib/geo';

export const missions = Router();

// GET /api/missions — 진행 중 미션 + 내 진행도
missions.get('/missions', wrap(async (req, res) => {
  const now = new Date();
  const list = await prisma.mission.findMany({ where: { periodStart: { lte: now }, periodEnd: { gte: now } }, orderBy: { periodEnd: 'asc' } });
  const prog = req.user ? await prisma.missionProgress.findMany({ where: { userId: req.user.id, missionId: { in: list.map((m) => m.id) } } }) : [];
  const byId = new Map(prog.map((p) => [p.missionId, p]));
  res.json({ items: list.map((m) => ({ ...m, progress: byId.get(m.id) ?? { value: 0, done: false } })) });
}));

// POST /api/missions/:code/proof — 로컬 맛집 인증(사진 URL + 위치). 가맹점 200m 이내면 인정
missions.post('/missions/:code/proof', requireUser, wrap(async (req, res) => {
  const body = z.object({ photoUrl: z.string().url().optional(), lat: z.number(), lng: z.number(), merchantId: z.string().optional() }).parse(req.body);
  const m = await prisma.mission.findUnique({ where: { code: String(req.params.code) } });
  if (!m) throw new HttpError(404, '미션이 없습니다');
  if (m.type !== 'LOCAL_FOOD') throw new HttpError(400, '인증형 미션이 아닙니다');
  const merchants = await prisma.merchant.findMany();
  const near = merchants.map((mc) => ({ mc, d: haversine([body.lat, body.lng], [mc.lat, mc.lng]) })).filter((x) => x.d <= 200).sort((a, b) => a.d - b.d)[0];
  if (!near) throw new HttpError(409, '가맹 후보 매장 200m 이내에서만 인증할 수 있어요');
  const rule = (m.rule ?? {}) as any;
  const prog = await prisma.missionProgress.upsert({ where: { userId_missionId: { userId: req.user!.id, missionId: m.id } }, create: { userId: req.user!.id, missionId: m.id, value: 1, proofUrl: body.photoUrl, done: 1 >= (rule.count ?? 1) }, update: { value: { increment: 1 }, proofUrl: body.photoUrl } });
  if (!prog.done && prog.value >= (rule.count ?? 1)) await prisma.missionProgress.update({ where: { id: prog.id }, data: { done: true } });
  res.json({ ok: true, merchant: near.mc.name, distance: Math.round(near.d), progress: prog });
}));

// GET /api/medals — 전체 메달 + 내 획득 여부, 챌린지 진행도
missions.get('/medals', wrap(async (req, res) => {
  const [medals, mine, challenges, myCh] = await Promise.all([
    prisma.medal.findMany({ orderBy: { code: 'asc' } }),
    req.user ? prisma.userMedal.findMany({ where: { userId: req.user.id } }) : [],
    prisma.challenge.findMany(),
    req.user ? prisma.userChallenge.findMany({ where: { userId: req.user.id } }) : [],
  ]);
  const mineIds = new Set(mine.map((m) => m.medalId));
  res.json({ medals: medals.map((m) => ({ ...m, earned: mineIds.has(m.id) })), challenges: challenges.map((c) => ({ ...c, completed: myCh.find((u) => u.challengeId === c.id)?.completedSlugs ?? [] })) });
}));
