import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { prisma } from './prisma';
import { hashSessionToken } from './password';

export const SESSION_COOKIE = 'ls_session';
export const LEGACY_ADMIN_COOKIE = 'ls_admin_session';
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export function cookieValue(req: Request, name: string) {
  const raw = req.headers.cookie || '';
  for (const item of raw.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

export function sessionToken(req: Request) {
  return cookieValue(req, SESSION_COOKIE) || cookieValue(req, LEGACY_ADMIN_COOKIE);
}

function cookieOptions(req: Request) {
  const secure = req.secure || String(req.header('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: SESSION_MS };
}

export async function startUserSession(req: Request, res: Response, userId: string) {
  const token = randomBytes(32).toString('base64url');
  await prisma.adminSession.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { userId }] } });
  await prisma.adminSession.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt: new Date(Date.now() + SESSION_MS) } });
  res.cookie(SESSION_COOKIE, token, cookieOptions(req));
  res.clearCookie(LEGACY_ADMIN_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export async function endUserSession(req: Request, res: Response) {
  const tokens = [cookieValue(req, SESSION_COOKIE), cookieValue(req, LEGACY_ADMIN_COOKIE)].filter(Boolean);
  if (tokens.length) await prisma.adminSession.deleteMany({ where: { tokenHash: { in: tokens.map(hashSessionToken) } } });
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.clearCookie(LEGACY_ADMIN_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
}
