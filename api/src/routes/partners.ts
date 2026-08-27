import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { wrap } from '../middleware/error';

export const partners = Router();

// GET /api/partners — 홈에 노출할 수성구 러닝 제휴·시연 혜택
partners.get('/partners', wrap(async (_req, res) => {
  const now = new Date();
  const merchants = await prisma.merchant.findMany({
    where: { addr: { contains: '수성구' } },
    include: {
      coupons: {
        where: { validUntil: { gte: now } },
        orderBy: { validUntil: 'asc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
    take: 5,
  });

  const items = [
    {
      id: 'runner-stay-padong',
      name: '러너스테이',
      category: '러너 웰니스 센터',
      addr: '대구광역시 수성구 용학로 12-1, 1층',
      offerTitle: '완주 러너 제휴 혜택 준비 중',
      discountKrw: null,
      validUntil: null,
      status: 'COMING_SOON' as const,
      source: 'CURATED' as const,
    },
    ...merchants
      .filter((merchant) => !merchant.name.replace(/\s/g, '').includes('러너스테이'))
      .flatMap((merchant) => merchant.coupons.map((coupon) => ({
        id: coupon.id,
        name: merchant.name,
        category: merchant.category,
        addr: merchant.addr,
        offerTitle: coupon.title,
        discountKrw: coupon.discountKrw,
        validUntil: coupon.validUntil.toISOString(),
        status: 'DEMO' as const,
        source: 'SEED' as const,
      }))),
  ];

  res.json({ items });
}));
