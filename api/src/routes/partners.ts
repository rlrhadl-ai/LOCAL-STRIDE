import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { wrap } from '../middleware/error';

export const partners = Router();

// GET /api/partners — 홈에 노출할 수성구 러닝 제휴·시연 혜택
partners.get('/partners', wrap(async (_req, res) => {
  const items = await prisma.partner.findMany({
    where: { status: { not: 'HIDDEN' } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: 20,
  });
  res.json({ items });
}));
