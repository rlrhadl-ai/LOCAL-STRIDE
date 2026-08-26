import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { tourConfigured } from '../lib/tourapi';
import { wrap } from '../middleware/error';

export const health = Router();
health.get('/health', wrap(async (_req, res) => {
  const [courses, pois] = await Promise.all([prisma.course.count(), prisma.poi.count()]);
  res.json({ ok: true, time: new Date().toISOString(), db: { courses, pois }, integrations: { tourapi: tourConfigured(), kma: Boolean(process.env.KMA_KEY), airkorea: Boolean(process.env.AIRKOREA_KEY), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) } });
}));
