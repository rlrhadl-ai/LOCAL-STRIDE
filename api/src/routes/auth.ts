import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, verifyPassword } from '../lib/password';
import { endUserSession, startUserSession } from '../lib/session';
import { requireAccount } from '../middleware/auth';
import { HttpError, wrap } from '../middleware/error';

export const auth = Router();
const attempts = new Map<string, { count: number; resetAt: number }>();
const password = z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(100)
  .regex(/[A-Za-z]/, '비밀번호에 영문자를 포함해 주세요')
  .regex(/[0-9]/, '비밀번호에 숫자를 포함해 주세요');
const credentials = z.object({ email: z.string().trim().email('이메일 형식을 확인해 주세요').transform((value) => value.toLowerCase()), password });
const publicUser = { id: true, email: true, nickname: true, role: true, avatarColor: true, avatarUrl: true } as const;

function loginAllowed(key: string) {
  const now = Date.now(); const current = attempts.get(key);
  if (!current || current.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 }); return true; }
  current.count += 1; return current.count <= 8;
}

auth.post('/auth/signup', wrap(async (req, res) => {
  const body = credentials.extend({ nickname: z.string().trim().min(2).max(16) }).parse(req.body);
  if (await prisma.user.findUnique({ where: { email: body.email }, select: { id: true } })) throw new HttpError(409, '이미 가입된 이메일입니다');
  const passwordHash = await hashPassword(body.password);
  const anonymous = req.user && !req.user.isAuthenticated ? await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, email: true, passwordHash: true } }) : null;
  const user = anonymous && !anonymous.email && !anonymous.passwordHash
    ? await prisma.user.update({ where: { id: anonymous.id }, data: { deviceId: null, email: body.email, passwordHash, nickname: body.nickname }, select: publicUser })
    : await prisma.user.create({ data: { email: body.email, passwordHash, nickname: body.nickname }, select: publicUser });
  await startUserSession(req, res, user.id);
  res.status(201).json({ user });
}));

auth.post('/auth/login', wrap(async (req, res) => {
  const key = `${req.ip}:${String(req.body?.email || '').toLowerCase()}`;
  if (!loginAllowed(key)) throw new HttpError(429, '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요');
  const body = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user?.passwordHash || !user.isActive || !await verifyPassword(body.password, user.passwordHash)) throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다');
  attempts.delete(key); await startUserSession(req, res, user.id);
  res.json({ user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl } });
}));

auth.post('/auth/logout', wrap(async (req, res) => { await endUserSession(req, res); res.status(204).end(); }));
auth.get('/auth/session', (req, res) => res.json({ user: req.user?.isAuthenticated ? req.user : null }));

auth.patch('/auth/password', requireAccount, wrap(async (req, res) => {
  const body = z.object({ currentPassword: z.string().min(1), newPassword: password }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { passwordHash: true } });
  if (!user?.passwordHash || !await verifyPassword(body.currentPassword, user.passwordHash)) throw new HttpError(400, '현재 비밀번호가 올바르지 않습니다');
  await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
  res.json({ ok: true });
}));
