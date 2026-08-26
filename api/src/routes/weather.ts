import { Router } from 'express';
import { z } from 'zod';
import { weatherNow } from '../lib/weather';
import { wrap } from '../middleware/error';

export const weather = Router();
// GET /api/weather/now?lat&lng  (기본: 수성못)
weather.get('/weather/now', wrap(async (req, res) => {
  const q = z.object({ lat: z.coerce.number().default(35.8277), lng: z.coerce.number().default(128.6177) }).parse(req.query);
  res.json(await weatherNow(q.lat, q.lng));
}));
