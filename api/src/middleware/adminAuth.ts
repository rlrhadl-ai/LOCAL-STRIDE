import type { NextFunction, Request, Response } from 'express';
declare global {
  namespace Express {
    interface Request { admin?: { id: string; email: string; nickname: string } }
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isAuthenticated || req.user.role !== 'ADMIN' || !req.user.email) return res.status(401).json({ error: '관리자 로그인이 필요합니다' });
  req.admin = { id: req.user.id, email: req.user.email, nickname: req.user.nickname };
  next();
}
