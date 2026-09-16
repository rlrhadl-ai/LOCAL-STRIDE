import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAccount } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';
import { HttpError, wrap } from '../middleware/error';
import { categories, statuses, reportBody, reportSelect, publicReport, distanceToRoute, csvCell } from '../lib/hazard-policy';

export const hazards = Router();
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, fieldSize: 4096 } }).single('photo');
const receivePhoto: RequestHandler = (req, res, next) => photoUpload(req, res, (error) => {
  if (error) return res.status(400).json({ error: '사진은 JPG·PNG·WebP 1장, 5MB 이하로 첨부해 주세요.' });
  next();
});
// Limit image decoding work, including invalid uploads. Bound memory and expiry per process.
const attempts = new Map<string, { count: number; expires: number }>();
const limitUploads: RequestHandler = (req, res, next) => {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.expires <= now) attempts.delete(key);
  const key = req.user!.id, bucket = attempts.get(key) ?? { count: 0, expires: now + 600000 };
  if (bucket.count >= 10) return res.status(429).json({ error: '10분 동안 사진 신고는 10번까지 시도할 수 있어요. 잠시 후 다시 시도해 주세요.' });
  if (attempts.size > 10000 && !attempts.has(key)) return res.status(503).json({ error: '신고 요청이 많습니다. 잠시 후 다시 시도해 주세요.' });
  bucket.count++; attempts.set(key, bucket); next();
};
hazards.use(['/hazards', '/admin/hazards'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

hazards.get('/hazards', wrap(async (req, res) => {
  const q = z.object({ courseId: z.string().min(1).max(100), page: z.coerce.number().int().min(1).max(10000).default(1) }).parse(req.query);
  const where: Prisma.HazardReportWhereInput = { courseId: q.courseId, course: { isPublic: true }, status: { in: ['RECEIVED', 'CONFIRMED', 'IN_PROGRESS'] } };
  const [items, total] = await Promise.all([
    prisma.hazardReport.findMany({ where, select: reportSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100, skip: (q.page - 1) * 100 }),
    prisma.hazardReport.count({ where }),
  ]);
  res.json({ items: items.map(publicReport), total, page: q.page, pageSize: 100 });
}));

hazards.get('/hazards/:id/photo', wrap(async (req, res) => {
  // Authorize and fetch in one query so a concurrent hide cannot bypass the access check.
  const access: Prisma.HazardReportWhereInput[] = [{ course: { isPublic: true }, status: { in: ['CONFIRMED', 'IN_PROGRESS', 'RESOLVED'] } }];
  if (req.user?.isAuthenticated && req.user.email) access.push({ authorId: req.user.id });
  const admin = req.user?.isAuthenticated && req.user.role === 'ADMIN' && req.user.email;
  const data = await prisma.hazardReport.findFirst({ where: { id: String(req.params.id), ...(admin ? {} : { OR: access }) }, select: { photo: true } });
  if (!data) throw new HttpError(404, '사진을 찾을 수 없습니다');
  res.set({ 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff' }).send(Buffer.from(data.photo));
}));

hazards.post('/hazards', requireAccount, limitUploads, receivePhoto, wrap(async (req, res) => {
  const parsed = reportBody.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || '신고 내용을 확인해 주세요.');
  const { consent: _consent, ...body } = parsed.data;
  const existing = await prisma.hazardReport.findUnique({ where: { requestId: body.requestId }, select: { id: true, authorId: true } });
  if (existing) {
    if (existing.authorId !== req.user!.id) throw new HttpError(409, '신고 요청 번호가 중복되었습니다. 새 신고를 작성해 주세요.');
    return res.json({ id: existing.id });
  }
  const course = await prisma.course.findFirst({ where: { id: body.courseId, isPublic: true }, select: { polyline: true } });
  if (!course) throw new HttpError(404, '공개된 코스를 선택해 주세요.');
  if (distanceToRoute([body.lat, body.lng], course.polyline) > 500) throw new HttpError(400, '선택한 코스에서 500m 이내의 지점을 선택해 주세요.');
  if (!req.file) throw new HttpError(400, '현장 사진 1장을 첨부해 주세요.');
  let photo: Buffer;
  try {
    const decoder = sharp(req.file.buffer, { limitInputPixels: 25000000, failOn: 'warning' });
    const metadata = await decoder.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages ?? 1) > 1) throw new Error('format');
    photo = await decoder.rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer();
    if (photo.length > 1024 * 1024) throw new Error('size');
  } catch { throw new HttpError(400, '읽을 수 있는 JPG·PNG·WebP 사진을 첨부해 주세요. 최대 2,500만 화소입니다.'); }
  try {
    const item = await prisma.hazardReport.create({ data: { ...body, authorId: req.user!.id, photo: new Uint8Array(photo) }, select: { id: true } });
    res.status(201).json(item);
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;
    const item = await prisma.hazardReport.findUnique({ where: { requestId: body.requestId }, select: { id: true, authorId: true } });
    if (!item || item.authorId !== req.user!.id) throw new HttpError(409, '신고 요청 번호가 중복되었습니다.');
    res.json({ id: item.id });
  }
}));

const filters = z.object({ status: z.enum(statuses).optional(), category: z.enum(categories).optional(), courseId: z.string().min(1).max(100).optional(), page: z.coerce.number().int().min(1).max(10000).default(1) });
function adminWhere(q: z.infer<typeof filters>): Prisma.HazardReportWhereInput {
  return { status: q.status, category: q.category, courseId: q.courseId };
}
hazards.get('/admin/hazards', requireAdmin, wrap(async (req, res) => {
  const q = filters.parse(req.query), where = adminWhere(q);
  const [items, total, counts, courseOptions] = await Promise.all([
    prisma.hazardReport.findMany({ where, select: reportSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25, skip: (q.page - 1) * 25 }),
    prisma.hazardReport.count({ where }),
    prisma.hazardReport.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.course.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  res.json({ items, total, page: q.page, pageSize: 25, counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), courses: courseOptions });
}));
hazards.get('/admin/hazards/export', requireAdmin, wrap(async (req, res) => {
  const q = filters.parse(req.query), where = adminWhere(q);
  const total = await prisma.hazardReport.count({ where });
  if (total > 10000) throw new HttpError(400, '최대 10,000건까지 내려받을 수 있습니다. 필터로 범위를 좁혀 주세요.');
  const items = await prisma.hazardReport.findMany({ where, select: reportSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 10000 });
  const rows = [['신고번호', '코스', '지역', '유형', '위험도', '상태', '위도', '경도', '위치입력', 'GPS정확도(m)', '설명', '공개처리안내', '접수일(UTC)', '수정일(UTC)'],
    ...items.map((r) => [r.id, r.course.name, r.course.areaName, r.category, r.severity, r.status, r.lat, r.lng, r.locationSource, r.accuracyM, r.description, r.publicNote, r.createdAt.toISOString(), r.updatedAt.toISOString()])];
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="localstride-hazards.csv"' }).send('\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'));
}));
hazards.get('/admin/hazards/:id', requireAdmin, wrap(async (req, res) => {
  const item = await prisma.hazardReport.findUnique({ where: { id: String(req.params.id) }, select: { ...reportSelect, history: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, note: true, createdAt: true, admin: { select: { nickname: true } } } } } });
  if (!item) throw new HttpError(404, '신고를 찾을 수 없습니다');
  res.json(item);
}));
hazards.patch('/admin/hazards/:id', requireAdmin, wrap(async (req, res) => {
  const body = z.object({ status: z.enum(statuses), version: z.number().int().positive(), publicNote: z.string().trim().max(300), note: z.string().trim().min(2).max(500) }).parse(req.body);
  const id = String(req.params.id);
  await prisma.$transaction(async (tx) => {
    const result = await tx.hazardReport.updateMany({ where: { id, version: body.version }, data: { status: body.status, publicNote: body.publicNote, version: { increment: 1 } } });
    if (!result.count) throw new HttpError(409, '다른 관리자가 수정했거나 신고가 없습니다. 새로고침 후 다시 확인해 주세요.');
    await tx.hazardReportHistory.create({ data: { reportId: id, adminId: req.admin!.id, status: body.status, note: body.note } });
  });
  res.json({ ok: true });
}));
