import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { hashSessionToken } from '../lib/password';

export const ADMIN_COOKIE = 'ls_admin_session';

declare global {
  namespace Express {
    interface Request { admin?: { id: string; email: string; nickname: string } }
  }
}

export function cookieValue(req: Request, name: string) {
  const raw = req.headers.cookie || '';
  for (const item of raw.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = cookieValue(req, ADMIN_COOKIE);
    if (!token) return res.status(401).json({ error: '관리자 로그인이 필요합니다' });
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { select: { id: true, email: true, nickname: true, role: true, isActive: true } } },
    });
    if (!session || session.expiresAt <= new Date() || session.user.role !== 'ADMIN' || !session.user.isActive || !session.user.email) {
      if (session) await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
      return res.status(401).json({ error: '관리자 세션이 만료되었습니다' });
    }
    req.admin = { id: session.user.id, email: session.user.email, nickname: session.user.nickname };
    next();
  } catch (error) { next(error); }
}
