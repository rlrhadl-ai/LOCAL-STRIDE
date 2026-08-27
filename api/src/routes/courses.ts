import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { cumulative, pointAt, polylineLength, haversine, type LatLng } from '../lib/geo';
import { nearby } from '../lib/tourapi';
import { HttpError, wrap } from '../middleware/error';
import { requireUser } from '../middleware/auth';

export const courses = Router();

const courseSelect = { id: true, slug: true, name: true, description: true, thumbnailUrl: true, distanceM: true, difficulty: true, themes: true, areaName: true, startLat: true, startLng: true, elevationGainM: true, estMinutes: true, source: true, isPublic: true, createdAt: true } as const;

// GET /api/courses?theme=수변&km=5
courses.get('/courses', wrap(async (req, res) => {
  const q = z.object({ theme: z.string().optional(), km: z.coerce.number().optional(), mine: z.coerce.boolean().optional() }).parse(req.query);
  const where: any = { isPublic: true };
  if (q.theme) where.themes = { has: q.theme };
  if (q.mine && req.user) where.creatorId = req.user.id, delete where.isPublic;
  let rows = await prisma.course.findMany({ where, select: { ...courseSelect, _count: { select: { checkpoints: true, runs: true } } }, orderBy: [{ source: 'asc' }, { createdAt: 'asc' }] });
  if (q.km) rows = rows.sort((a, b) => Math.abs(a.distanceM - q.km! * 1000) - Math.abs(b.distanceM - q.km! * 1000));
  res.json({ items: rows });
}));

// GET /api/courses/:idOrSlug — 체크포인트 + 코스 POI 포함
courses.get('/courses/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  const course = await prisma.course.findFirst({ where: { OR: [{ id }, { slug: id }] }, include: { checkpoints: { orderBy: { order: 'asc' } }, pois: { include: { poi: true }, orderBy: { distFromStartM: 'asc' } } } });
  if (!course) throw new HttpError(404, '코스를 찾을 수 없습니다');
  res.json(course);
}));

/**
 * POST /api/courses — 코스 빌더
 * body: { name, description?, themes[], difficulty?, points: [[lat,lng],...], checkpointEveryM?: 1000 }
 * - 거리 자동 계산, 체크포인트 자동 배치, 경로 위 주변 관광지(TourAPI locationBasedList2)를 자동으로 붙인다.
 */
courses.post('/courses', requireUser, wrap(async (req, res) => {
  const body = z.object({
    name: z.string().min(2).max(40),
    description: z.string().max(300).default(''),
    themes: z.array(z.string()).min(1).max(4),
    difficulty: z.enum(['초급', '초중급', '중급', '상급']).default('초중급'),
    points: z.array(z.tuple([z.number(), z.number()])).min(2).max(2000),
    checkpointEveryM: z.number().min(300).max(5000).default(1000),
    isPublic: z.boolean().default(true),
  }).parse(req.body);
  const pts = body.points as LatLng[];
  const cum = cumulative(pts);
  const total = Math.round(cum[cum.length - 1]);
  if (total < 300) throw new HttpError(400, '코스가 너무 짧습니다 (300m 이상)');
  const slug = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const estMinutes = Math.round((total / 1000) * 6.5);

  // 체크포인트: 출발 + N m 마다 + 피니시
  const cps: { order: number; name: string; kind: string; distM: number; lat: number; lng: number; reward: boolean }[] = [];
  cps.push({ order: 0, name: '출발', kind: '출발', distM: 0, lat: pts[0][0], lng: pts[0][1], reward: false });
  let n = 1;
  for (let d = body.checkpointEveryM; d < total - 200; d += body.checkpointEveryM) { const p = pointAt(pts, cum, d); cps.push({ order: n, name: `체크포인트 ${n}`, kind: '러닝 구간', distM: Math.round(d), lat: p[0], lng: p[1], reward: false }); n++; }
  cps.push({ order: n, name: '피니시', kind: '피니시', distM: total, lat: pts[pts.length - 1][0], lng: pts[pts.length - 1][1], reward: true });

  // 경로 주변 관광지 자동 첨부: 600m 간격 샘플 지점에서 반경 300m 조회, contentId 기준 중복 제거
  const attached = new Map<string, { poiId: string; distFromStartM: number }>();
  let lastSource: 'TOURAPI' | 'SEED' = 'SEED';
  for (let d = 0; d <= total; d += 600) {
    const p = pointAt(pts, cum, d);
    const r = await nearby(p[0], p[1], 300, undefined, 8);
    lastSource = r.source;
    for (const it of r.items) {
      const key = it.contentId ?? `${it.title}@${it.lat.toFixed(4)},${it.lng.toFixed(4)}`;
      if (attached.has(key)) continue;
      const poi = it.contentId
        ? await prisma.poi.findUnique({ where: { contentId: it.contentId } })
        : it.id ? await prisma.poi.findUnique({ where: { id: it.id } }) : null;
      if (!poi) continue;
      // 경로상 최근접 지점의 누적 거리
      let best = 0, bestD = Infinity;
      for (let i = 0; i < pts.length; i++) { const dd = haversine(pts[i], [poi.lat, poi.lng]); if (dd < bestD) { bestD = dd; best = cum[i]; } }
      attached.set(key, { poiId: poi.id, distFromStartM: Math.round(best) });
    }
  }
  const course = await prisma.course.create({
    data: {
      slug, name: body.name, description: body.description || `${req.user!.nickname}님이 만든 코스`, distanceM: total, difficulty: body.difficulty, themes: body.themes,
      startLat: pts[0][0], startLng: pts[0][1], polyline: pts, estMinutes, source: 'USER', creatorId: req.user!.id, isPublic: body.isPublic,
      checkpoints: { create: cps },
      pois: { create: [...attached.values()].map((a) => ({ poiId: a.poiId, distFromStartM: a.distFromStartM })) },
    },
    include: { checkpoints: { orderBy: { order: 'asc' } }, pois: { include: { poi: true } } },
  });
  res.status(201).json({ ...course, enrichment: { source: lastSource, poiCount: attached.size } });
}));
