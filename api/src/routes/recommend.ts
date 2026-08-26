import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { weatherNow } from '../lib/weather';
import { wrap } from '../middleware/error';

export const recommend = Router();

/**
 * GET /api/recommend?km=5&themes=수변,야경&lat&lng
 * 규칙 기반 점수 + 추천 이유 3줄. (2단계: 러닝 기록 학습 가중치)
 */
recommend.get('/recommend', wrap(async (req, res) => {
  const q = z.object({ km: z.coerce.number().default(5), themes: z.string().default(''), lat: z.coerce.number().default(35.8277), lng: z.coerce.number().default(128.6177) }).parse(req.query);
  const themes = q.themes.split(',').map((s) => s.trim()).filter(Boolean);
  const [courses, wx] = await Promise.all([prisma.course.findMany({ where: { isPublic: true } }), weatherNow(q.lat, q.lng)]);
  const hourKst = (new Date().getUTCHours() + 9) % 24;
  const recentKm = req.user ? await prisma.run.aggregate({ _avg: { distanceM: true }, where: { userId: req.user.id, status: 'FINISHED', valid: true } }).then((r) => (r._avg.distanceM ?? 0) / 1000) : 0;

  const scored = courses.map((c) => {
    const km = c.distanceM / 1000;
    let score = 0; const reasons: string[] = [];
    const dk = Math.abs(km - q.km); score += Math.max(0, 3 - dk);
    if (dk < 1.2) reasons.push(recentKm ? `최근 평균 ${recentKm.toFixed(1)}km 기록과 거리 일치 (${km.toFixed(1)}km)` : `선택한 거리 ${q.km}km에 맞는 ${km.toFixed(1)}km 코스`);
    const overlap = c.themes.filter((t) => themes.includes(t)); score += overlap.length * 2;
    if (overlap.length) reasons.push(`선호 테마 '${overlap.join('·')}' 반영`);
    if (c.themes.includes('야경') && (themes.includes('야경') || hourKst >= 17)) { score += 1; reasons.push(`${wx.sky} ${wx.temp}°C · 일몰 ${wx.sunset} → 19:00–21:00 야경 시간대 최적`); }
    if (wx.rainType !== '없음') { score -= 2; reasons.push(`현재 ${wx.rainType} — 짧은 코스 권장`); }
    if (['좋음', '보통'].includes(wx.pm10Grade) && c.themes.includes('수변')) reasons.push(`미세먼지 ${wx.pm10Grade} · 수변 러닝 적합`);
    if (c.elevationGainM <= 40) reasons.push(`평지 위주 · 누적 고도 ${c.elevationGainM}m`);
    if (c.source === 'USER') score -= 0.5;
    return { course: { id: c.id, slug: c.slug, name: c.name, distanceM: c.distanceM, difficulty: c.difficulty, themes: c.themes, estMinutes: c.estMinutes, source: c.source }, score: Math.round(score * 10) / 10, reasons: reasons.slice(0, 3) };
  }).sort((a, b) => b.score - a.score);
  res.json({ weather: wx, input: { km: q.km, themes, hourKst }, best: scored[0] ?? null, candidates: scored });
}));
