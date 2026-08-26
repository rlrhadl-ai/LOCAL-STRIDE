import { Router } from 'express';
import { z } from 'zod';
import { nearby, detail } from '../lib/tourapi';
import { askCompanion } from '../lib/ai';
import { wrap } from '../middleware/error';

export const ai = Router();

// POST /api/ai/ask { question, lat, lng, courseName?, distanceM? }
ai.post('/ai/ask', wrap(async (req, res) => {
  const body = z.object({ question: z.string().min(1).max(200), lat: z.number(), lng: z.number(), courseName: z.string().optional(), distanceM: z.number().optional() }).parse(req.body);
  const near = await nearby(body.lat, body.lng, 500, undefined, 8);
  // 상위 2곳은 개요까지 채워서 컨텍스트로 (캐시되어 있으면 즉시)
  for (const p of near.items.slice(0, 2)) { if (p.contentId && !p.overview) { const d = await detail(p.contentId); p.overview = d.overview; } }
  const started = Date.now();
  const out = await askCompanion(body.question, near.items, { courseName: body.courseName, distanceM: body.distanceM });
  res.json({ ...out, latencyMs: Date.now() - started, context: { source: near.source, pois: near.items.slice(0, 5).map((p) => ({ title: p.title, type: p.type, dist: p.dist })) } });
}));
