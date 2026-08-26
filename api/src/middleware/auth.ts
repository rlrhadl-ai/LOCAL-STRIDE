import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

declare global {
  namespace Express {
    interface Request { user?: { id: string; nickname: string } }
  }
}

/**
 * 익명 기기 인증 — 프론트가 보내는 x-device-id 로 사용자를 만들거나 찾는다.
 * 2단계에서 카카오 로그인 + 휴대폰 인증이 붙으면 이 미들웨어 뒤에 세션 검증을 추가한다.
 */
export async function deviceAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const deviceId = String(req.header('x-device-id') || '').trim();
    if (!deviceId) return next();
    const suffix = deviceId.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase() || 'RUN';
    const select = { id: true, nickname: true } as const;
    let user = await prisma.user.findUnique({ where: { deviceId }, select });
    if (!user) {
      try { user = await prisma.user.create({ data: { deviceId, nickname: `러너-${suffix}` }, select }); }
      catch (e: any) { if (e?.code !== 'P2002') throw e; user = await prisma.user.findUnique({ where: { deviceId }, select }); } // 동시 요청 레이스
    }
    req.user = user ?? undefined;
    next();
  } catch (e) { next(e); }
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'x-device-id 헤더가 필요합니다' });
  next();
}
