import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { nearby, detail, festivals } from '../lib/tourapi';
import { wrap } from '../middleware/error';

export const tour = Router();
const tourHits = new Map<string, { count: number; resetAt: number }>();

function tourRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const hit = tourHits.get(key);
  if (!hit || hit.resetAt <= now) tourHits.set(key, { count: 1, resetAt: now + 60_000 });
  else {
    hit.count += 1;
    if (hit.count > 90) return res.status(429).json({ error: '관광정보 요청이 많습니다. 잠시 후 다시 시도해 주세요.' });
  }
  if (tourHits.size > 5000) for (const [ip, value] of tourHits) if (value.resetAt <= now) tourHits.delete(ip);
  next();
}

tour.use('/tour', tourRateLimit);

// GET /api/tour/nearby?lat=35.8277&lng=128.6177&radius=500&type=12
tour.get('/tour/nearby', wrap(async (req, res) => {
  const q = z.object({ lat: z.coerce.number(), lng: z.coerce.number(), radius: z.coerce.number().min(50).max(5000).default(500), type: z.coerce.number().optional(), limit: z.coerce.number().min(1).max(50).default(20) }).parse(req.query);
  res.json(await nearby(q.lat, q.lng, q.radius, q.type, q.limit));
}));
// GET /api/tour/detail/:contentId
tour.get('/tour/detail/:contentId', wrap(async (req, res) => {
  res.json(await detail(String(req.params.contentId)));
}));

// GET /api/tour/festivals?from=2026-09-01
tour.get('/tour/festivals', wrap(async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date();
  res.json(await festivals(from));
}));
