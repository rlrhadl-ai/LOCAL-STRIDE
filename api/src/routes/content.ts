import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { wrap } from '../middleware/error';

export const content = Router();

content.get('/banners', wrap(async (_req, res) => {
  const now = new Date();
  const items = await prisma.banner.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
  res.json({ items });
}));
