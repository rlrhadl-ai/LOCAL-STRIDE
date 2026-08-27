import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';
import { haversine } from '../lib/geo';

export const missions = Router();

interface MissionReward {
  type: 'COUPON' | 'LOCAL_CURRENCY';
  title: string;
  amountKrw: number;
  couponTitle: string;
  merchantName: string;
  status: 'DEMO' | 'ACTIVE';
  notice?: string;
}

const rewardFromRule = (rule: unknown): MissionReward | null => {
  if (!rule || typeof rule !== 'object' || !('reward' in rule)) return null;
  const parsed = z.object({
    type: z.enum(['COUPON', 'LOCAL_CURRENCY']),
    title: z.string(),
    amountKrw: z.number().int().nonnegative(),
    couponTitle: z.string(),
    merchantName: z.string(),
    status: z.enum(['DEMO', 'ACTIVE']).default('DEMO'),
    notice: z.string().optional(),
  }).safeParse((rule as { reward?: unknown }).reward);
  return parsed.success ? parsed.data : null;
};

const rewardCode = (missionCode: string, userId: string) => {
  const digest = createHash('sha256').update(missionCode + ':' + userId).digest('hex').slice(0, 10).toUpperCase();
  return 'LSM-' + missionCode.replace(/[^A-Z0-9]/g, '').slice(0, 12) + '-' + digest;
};

// GET /api/missions — 진행 중 미션 + 내 진행도
missions.get('/missions', wrap(async (req, res) => {
  const now = new Date();
  const list = await prisma.mission.findMany({ where: { periodStart: { lte: now }, periodEnd: { gte: now } }, orderBy: { periodEnd: 'asc' } });
  const prog = req.user ? await prisma.missionProgress.findMany({ where: { userId: req.user.id, missionId: { in: list.map((m) => m.id) } } }) : [];
  const codes = req.user ? list.filter((m) => rewardFromRule(m.rule)).map((m) => rewardCode(m.code, req.user!.id)) : [];
  const claimed = req.user && codes.length ? await prisma.userCoupon.findMany({ where: { userId: req.user.id, code: { in: codes } }, select: { code: true } }) : [];
  const claimedCodes = new Set(claimed.map((item) => item.code));
  const byId = new Map(prog.map((p) => [p.missionId, p]));
  res.json({ items: list.map((m) => {
    const reward = rewardFromRule(m.rule);
    const code = req.user && reward ? rewardCode(m.code, req.user.id) : null;
    return { ...m, progress: byId.get(m.id) ?? { value: 0, done: false }, reward: reward ? { ...reward, claimed: Boolean(code && claimedCodes.has(code)), claimCode: code && claimedCodes.has(code) ? code : null } : null };
  }) });
}));

// POST /api/missions/:code/proof — 로컬 맛집 인증(사진 URL + 위치). 가맹점 200m 이내면 인정
missions.post('/missions/:code/proof', requireUser, wrap(async (req, res) => {
  const body = z.object({ photoUrl: z.string().url().optional(), lat: z.number(), lng: z.number(), merchantId: z.string().optional() }).parse(req.body);
  const m = await prisma.mission.findUnique({ where: { code: String(req.params.code) } });
  if (!m) throw new HttpError(404, '미션이 없습니다');
  if (m.type !== 'LOCAL_FOOD') throw new HttpError(400, '인증형 미션이 아닙니다');
  const merchants = await prisma.merchant.findMany({ where: { category: { notIn: ['미션 리워드', '지역화폐 리워드'] } } });
  const near = merchants.map((mc) => ({ mc, d: haversine([body.lat, body.lng], [mc.lat, mc.lng]) })).filter((x) => x.d <= 200).sort((a, b) => a.d - b.d)[0];
  if (!near) throw new HttpError(409, '가맹 후보 매장 200m 이내에서만 인증할 수 있어요');
  const rule = (m.rule ?? {}) as any;
  const target = rule.count ?? 1;
  let prog = await prisma.missionProgress.upsert({ where: { userId_missionId: { userId: req.user!.id, missionId: m.id } }, create: { userId: req.user!.id, missionId: m.id, value: 1, proofUrl: body.photoUrl, done: 1 >= target }, update: { value: { increment: 1 }, proofUrl: body.photoUrl } });
  if (!prog.done && prog.value >= target) prog = await prisma.missionProgress.update({ where: { id: prog.id }, data: { done: true } });
  res.json({ ok: true, merchant: near.mc.name, distance: Math.round(near.d), progress: prog });
}));

// POST /api/missions/:code/claim — 완료한 미션의 쿠폰·지역화폐 연계 보상 1회 수령
missions.post('/missions/:code/claim', requireUser, wrap(async (req, res) => {
  const now = new Date();
  const mission = await prisma.mission.findUnique({ where: { code: String(req.params.code) } });
  if (!mission || mission.periodStart > now || mission.periodEnd < now) throw new HttpError(404, '진행 중인 미션이 아닙니다');
  const progress = await prisma.missionProgress.findUnique({ where: { userId_missionId: { userId: req.user!.id, missionId: mission.id } } });
  if (!progress?.done) throw new HttpError(409, '미션을 완료한 뒤 보상을 받을 수 있어요');
  const reward = rewardFromRule(mission.rule);
  if (!reward) throw new HttpError(409, '수령할 수 있는 보상이 없는 미션입니다');
  if (reward.type === 'LOCAL_CURRENCY' && !req.user!.isAuthenticated) throw new HttpError(401, '지역화폐 리워드는 로그인 후 받을 수 있어요');
  const coupon = await prisma.coupon.findFirst({ where: { title: reward.couponTitle, merchant: { name: reward.merchantName }, validUntil: { gte: now } }, include: { merchant: true } });
  if (!coupon) throw new HttpError(409, '보상 준비 중입니다. 운영자에게 문의해 주세요');
  const code = rewardCode(mission.code, req.user!.id);
  const existing = await prisma.userCoupon.findUnique({ where: { code } });
  if (existing && existing.userId !== req.user!.id) throw new HttpError(409, '보상 발급 코드를 확인할 수 없습니다');
  const issued = await prisma.userCoupon.upsert({ where: { code }, create: { userId: req.user!.id, couponId: coupon.id, code }, update: {} });
  res.status(existing ? 200 : 201).json({
    alreadyClaimed: Boolean(existing),
    code: issued.code,
    reward: { ...reward, validUntil: coupon.validUntil.toISOString(), merchant: coupon.merchant.name },
  });
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
