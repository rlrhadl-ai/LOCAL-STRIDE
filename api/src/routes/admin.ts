import { randomBytes, timingSafeEqual } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { hashPassword, hashSessionToken, verifyPassword } from '../lib/password';
import { imageUpload } from '../lib/uploads';
import { ADMIN_COOKIE, cookieValue, requireAdmin } from '../middleware/adminAuth';
import { HttpError, wrap } from '../middleware/error';

export const admin = Router();
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const allowedEmails = new Set((process.env.ADMIN_EMAILS || 'toy146@naver.com').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
const adminSetupCode = String(process.env.ADMIN_SETUP_CODE || '');
const attempts = new Map<string, { count: number; resetAt: number }>();
const imageUrl = z.string().max(1000).refine((value) => value.startsWith('/') || /^https?:\/\//i.test(value), '이미지 URL 형식이 올바르지 않습니다');
const optionalDate = z.preprocess((value) => value === '' || value == null ? null : new Date(String(value)), z.date().nullable());

function loginAllowed(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 }); return true; }
  current.count += 1;
  return current.count <= 8;
}

function clearLoginAttempts(key: string) { attempts.delete(key); }
function sameSecret(left: string, right: string) { const a = Buffer.from(left), b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }

async function startSession(req: any, res: any, userId: string) {
  const token = randomBytes(32).toString('base64url');
  await prisma.adminSession.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { userId }] } });
  await prisma.adminSession.create({ data: { tokenHash: hashSessionToken(token), userId, expiresAt: new Date(Date.now() + SESSION_MS) } });
  const secure = req.secure || String(req.header('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
  res.cookie(ADMIN_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: SESSION_MS });
}

const credentials = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(10, '비밀번호는 10자 이상이어야 합니다').max(100),
});

admin.post('/admin/auth/signup', wrap(async (req, res) => {
  const body = credentials.extend({ nickname: z.string().trim().min(2).max(20).default('LOCAL STRIDE 관리자'), setupCode: z.string().min(8).max(200) }).parse(req.body);
  if (!allowedEmails.has(body.email)) throw new HttpError(403, '등록된 관리자 이메일만 가입할 수 있습니다');
  if (!adminSetupCode) throw new HttpError(503, '서버에 최초 가입 코드가 설정되지 않았습니다');
  if (!sameSecret(body.setupCode, adminSetupCode)) throw new HttpError(403, '최초 가입 코드가 올바르지 않습니다');
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw new HttpError(409, '이미 가입된 관리자 이메일입니다');
  const user = await prisma.user.create({ data: { email: body.email, passwordHash: await hashPassword(body.password), nickname: body.nickname, role: 'ADMIN' } });
  await startSession(req, res, user.id);
  res.status(201).json({ user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role } });
}));

admin.post('/admin/auth/login', wrap(async (req, res) => {
  const key = `${req.ip}:${String(req.body?.email || '').toLowerCase()}`;
  if (!loginAllowed(key)) throw new HttpError(429, '로그인 시도가 많습니다. 15분 후 다시 시도해 주세요');
  const body = credentials.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user?.passwordHash || user.role !== 'ADMIN' || !user.isActive || !await verifyPassword(body.password, user.passwordHash)) throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다');
  clearLoginAttempts(key);
  await startSession(req, res, user.id);
  res.json({ user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role } });
}));

admin.post('/admin/auth/logout', wrap(async (req, res) => {
  const token = cookieValue(req, ADMIN_COOKIE);
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  res.clearCookie(ADMIN_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
  res.status(204).end();
}));

admin.get('/admin/auth/session', requireAdmin, (req, res) => res.json({ user: req.admin }));
admin.use('/admin', requireAdmin);

admin.get('/admin/dashboard', wrap(async (_req, res) => {
  const [users, courses, pois, partners, banners, runs, recentUsers] = await Promise.all([
    prisma.user.count(), prisma.course.count(), prisma.poi.count(), prisma.partner.count(), prisma.banner.count(), prisma.run.count(),
    prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, nickname: true, email: true, role: true, isActive: true, createdAt: true } }),
  ]);
  res.json({ counts: { users, courses, pois, partners, banners, runs }, recentUsers });
}));

admin.post('/admin/uploads', imageUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'JPG, PNG, WEBP 또는 GIF 이미지를 선택해 주세요' });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size });
});

admin.get('/admin/users', wrap(async (_req, res) => {
  const items = await prisma.user.findMany({
    select: { id: true, nickname: true, email: true, role: true, isActive: true, phoneVerified: true, createdAt: true, _count: { select: { runs: true, courses: true } } },
    orderBy: { createdAt: 'desc' }, take: 500,
  });
  res.json({ items });
}));

admin.patch('/admin/users/:id', wrap(async (req, res) => {
  const body = z.object({ nickname: z.string().trim().min(2).max(20).optional(), isActive: z.boolean().optional() }).parse(req.body);
  if (req.params.id === req.admin!.id && body.isActive === false) throw new HttpError(400, '현재 로그인한 관리자 계정은 비활성화할 수 없습니다');
  res.json(await prisma.user.update({ where: { id: String(req.params.id) }, data: body, select: { id: true, nickname: true, email: true, role: true, isActive: true } }));
}));

admin.get('/admin/courses', wrap(async (_req, res) => {
  const items = await prisma.course.findMany({ include: { _count: { select: { runs: true, checkpoints: true, pois: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ items });
}));

const courseUpdate = z.object({
  name: z.string().trim().min(2).max(60).optional(), description: z.string().max(1000).optional(), thumbnailUrl: imageUrl.nullable().optional(),
  difficulty: z.enum(['초급', '초중급', '중급', '상급']).optional(), themes: z.array(z.string().min(1).max(20)).max(8).optional(), areaName: z.string().max(80).optional(),
  estMinutes: z.number().int().min(1).max(1000).optional(), elevationGainM: z.number().int().min(0).max(10000).optional(), isPublic: z.boolean().optional(),
});
admin.patch('/admin/courses/:id', wrap(async (req, res) => res.json(await prisma.course.update({ where: { id: String(req.params.id) }, data: courseUpdate.parse(req.body) }))));
admin.delete('/admin/courses/:id', wrap(async (req, res) => {
  const id = String(req.params.id);
  const course = await prisma.course.findUnique({ where: { id }, select: { _count: { select: { runs: true, events: true, crewRuns: true } } } });
  if (!course) throw new HttpError(404, '코스를 찾을 수 없습니다');
  if (course._count.runs || course._count.events || course._count.crewRuns) throw new HttpError(409, '기록 또는 일정이 연결된 코스는 삭제 대신 비공개로 전환해 주세요');
  await prisma.course.delete({ where: { id } });
  res.status(204).end();
}));

admin.get('/admin/pois', wrap(async (_req, res) => res.json({ items: await prisma.poi.findMany({ orderBy: { fetchedAt: 'desc' }, take: 500 }) })));
const poiBody = z.object({
  contentId: z.string().max(100).nullable().optional(), contentTypeId: z.number().int().min(1), title: z.string().trim().min(2).max(100), addr1: z.string().max(300).nullable().optional(),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), firstImage: imageUrl.nullable().optional(), tel: z.string().max(60).nullable().optional(), overview: z.string().max(3000).nullable().optional(),
});
admin.post('/admin/pois', wrap(async (req, res) => res.status(201).json(await prisma.poi.create({ data: { ...poiBody.parse(req.body), source: 'SEED' } }))));
admin.patch('/admin/pois/:id', wrap(async (req, res) => res.json(await prisma.poi.update({ where: { id: String(req.params.id) }, data: poiBody.partial().parse(req.body) }))));
admin.delete('/admin/pois/:id', wrap(async (req, res) => { await prisma.poi.delete({ where: { id: String(req.params.id) } }); res.status(204).end(); }));

admin.get('/admin/partners', wrap(async (_req, res) => res.json({ items: await prisma.partner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }) })));
const partnerBody = z.object({
  name: z.string().trim().min(2).max(100), category: z.string().trim().min(1).max(50), addr: z.string().max(300).nullable().optional(), offerTitle: z.string().trim().min(2).max(200),
  discountKrw: z.number().int().min(0).max(10000000).nullable().optional(), validUntil: optionalDate.optional(), status: z.enum(['COMING_SOON', 'ACTIVE', 'DEMO', 'HIDDEN']), imageUrl: imageUrl.nullable().optional(), sortOrder: z.number().int().min(0).max(10000).default(0),
});
admin.post('/admin/partners', wrap(async (req, res) => res.status(201).json(await prisma.partner.create({ data: partnerBody.parse(req.body) }))));
admin.patch('/admin/partners/:id', wrap(async (req, res) => res.json(await prisma.partner.update({ where: { id: String(req.params.id) }, data: partnerBody.partial().parse(req.body) }))));
admin.delete('/admin/partners/:id', wrap(async (req, res) => { await prisma.partner.delete({ where: { id: String(req.params.id) } }); res.status(204).end(); }));

admin.get('/admin/banners', wrap(async (_req, res) => res.json({ items: await prisma.banner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] }) })));
const bannerBody = z.object({
  title: z.string().trim().min(2).max(100), subtitle: z.string().max(200).nullable().optional(), imageUrl, linkUrl: z.string().max(1000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).default(0), isActive: z.boolean().default(true), startsAt: optionalDate.optional(), endsAt: optionalDate.optional(),
});
admin.post('/admin/banners', wrap(async (req, res) => res.status(201).json(await prisma.banner.create({ data: bannerBody.parse(req.body) }))));
admin.patch('/admin/banners/:id', wrap(async (req, res) => res.json(await prisma.banner.update({ where: { id: String(req.params.id) }, data: bannerBody.partial().parse(req.body) }))));
admin.delete('/admin/banners/:id', wrap(async (req, res) => { await prisma.banner.delete({ where: { id: String(req.params.id) } }); res.status(204).end(); }));
