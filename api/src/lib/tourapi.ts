/**
 * 한국관광공사 TourAPI 4.0 (KorService2) 클라이언트
 * - 키가 없거나 호출이 실패하면 DB의 SEED/캐시 데이터로 폴백하고 source 를 표시한다.
 * - 응답은 contentId 기준으로 Poi 테이블에 캐시된다 (fetchedAt 갱신).
 */
import { prisma } from './prisma';
import { haversine, M_PER_DEG_LAT, mPerDegLng } from './geo';

const BASE = 'https://apis.data.go.kr/B551011/KorService2';
const KEY = process.env.TOURAPI_KEY || '';

export const CONTENT_TYPES: Record<number, string> = { 12: '관광지', 14: '문화시설', 15: '축제공연행사', 25: '여행코스', 28: '레포츠', 32: '숙박', 38: '쇼핑', 39: '음식점' };

export interface PoiItem {
  id?: string;
  contentId: string | null;
  contentTypeId: number;
  type: string;
  title: string;
  addr1: string | null;
  lat: number;
  lng: number;
  dist: number; // m
  firstImage: string | null;
  tel: string | null;
  overview?: string | null;
}

export interface NearbyResult {
  source: 'TOURAPI' | 'SEED';
  fetchedMs: number;
  endpoint: string;
  items: PoiItem[];
  cached?: boolean;
  raw?: unknown; // 시연용: 첫 번째 원본 item
  error?: string;
}

const NEARBY_CACHE_TTL_MS = 5 * 60 * 1000;
const nearbyCache = new Map<string, { expiresAt: number; value: NearbyResult }>();

function nearbyCacheKey(lat: number, lng: number, radiusM: number, contentTypeId?: number, limit = 20) {
  return [lat.toFixed(4), lng.toFixed(4), radiusM, contentTypeId ?? 'all', limit].join(':');
}

function buildUrl(path: string, params: Record<string, string | number>) {
  const q = new URLSearchParams({ MobileOS: 'ETC', MobileApp: 'LocalStride', _type: 'json', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  // serviceKey 는 Decoding 키를 넣고 URLSearchParams 가 인코딩하게 둔다 (이중 인코딩 방지)
  return `${BASE}/${path}?serviceKey=${encodeURIComponent(KEY)}&${q.toString()}`;
}

async function callTour(path: string, params: Record<string, string | number>, timeoutMs = 6000): Promise<any[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(buildUrl(path, params), { signal: ctrl.signal });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`TourAPI non-JSON response: ${text.slice(0, 120)}`); }
    const header = json?.response?.header;
    if (header && header.resultCode !== '0000') throw new Error(`TourAPI ${header.resultCode}: ${header.resultMsg}`);
    const items = json?.response?.body?.items?.item;
    return Array.isArray(items) ? items : items ? [items] : [];
  } finally { clearTimeout(t); }
}

/** 반경 내 SEED/캐시 POI (bbox → haversine) */
export async function nearbyFromDb(lat: number, lng: number, radiusM: number, limit = 20): Promise<PoiItem[]> {
  const dLat = radiusM / M_PER_DEG_LAT, dLng = radiusM / mPerDegLng(lat);
  const rows = await prisma.poi.findMany({ where: { lat: { gte: lat - dLat, lte: lat + dLat }, lng: { gte: lng - dLng, lte: lng + dLng } }, take: 200 });
  return rows
    .map((p) => ({ id: p.id, contentId: p.contentId, contentTypeId: p.contentTypeId, type: CONTENT_TYPES[p.contentTypeId] ?? '장소', title: p.title, addr1: p.addr1, lat: p.lat, lng: p.lng, dist: Math.round(haversine([lat, lng], [p.lat, p.lng])), firstImage: p.firstImage, tel: p.tel, overview: p.overview }))
    .filter((p) => p.dist <= radiusM)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit);
}

/** 위치기반 관광정보 (locationBasedList2) — 반경 내 관광지·음식점 등 */
export async function nearby(lat: number, lng: number, radiusM = 500, contentTypeId?: number, limit = 20): Promise<NearbyResult> {
  const endpoint = 'locationBasedList2';
  const started = Date.now();
  if (!KEY) {
    const items = await nearbyFromDb(lat, lng, radiusM, limit);
    return { source: 'SEED', fetchedMs: Date.now() - started, endpoint, items, error: 'TOURAPI_KEY 미설정 — 저장 데이터 사용' };
  }
  const cacheKey = nearbyCacheKey(lat, lng, radiusM, contentTypeId, limit);
  const cached = nearbyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, fetchedMs: 0, cached: true };
  if (cached) nearbyCache.delete(cacheKey);
  try {
    const params: Record<string, string | number> = { mapX: lng, mapY: lat, radius: radiusM, arrange: 'E', numOfRows: limit, pageNo: 1 };
    if (contentTypeId) params.contentTypeId = contentTypeId;
    const raw = await callTour(endpoint, params);
    const items: PoiItem[] = raw.map((it) => ({
      contentId: String(it.contentid), contentTypeId: Number(it.contenttypeid), type: CONTENT_TYPES[Number(it.contenttypeid)] ?? '장소',
      title: it.title, addr1: it.addr1 || null, lat: Number(it.mapy), lng: Number(it.mapx), dist: Math.round(Number(it.dist) || 0),
      firstImage: it.firstimage || it.firstimage2 || null, tel: it.tel || null,
    })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    // 캐시 upsert (실패해도 응답은 준다)
    await Promise.all(items.map((p, i) => prisma.poi.upsert({
      where: { contentId: p.contentId! },
      create: { contentId: p.contentId!, contentTypeId: p.contentTypeId, title: p.title, addr1: p.addr1, lat: p.lat, lng: p.lng, firstImage: p.firstImage, tel: p.tel, source: 'TOURAPI', raw: raw[i] },
      update: { title: p.title, addr1: p.addr1, lat: p.lat, lng: p.lng, firstImage: p.firstImage, tel: p.tel, fetchedAt: new Date(), raw: raw[i] },
    }).catch(() => null)));
    const result: NearbyResult = { source: 'TOURAPI', fetchedMs: Date.now() - started, endpoint, items, raw: raw[0] ?? null, cached: false };
    nearbyCache.set(cacheKey, { expiresAt: Date.now() + NEARBY_CACHE_TTL_MS, value: result });
    if (nearbyCache.size > 500) for (const [key, value] of nearbyCache) if (value.expiresAt <= Date.now()) nearbyCache.delete(key);
    return result;
  } catch (e: any) {
    const items = await nearbyFromDb(lat, lng, radiusM, limit);
    return { source: 'SEED', fetchedMs: Date.now() - started, endpoint, items, error: `TourAPI 호출 실패 — ${e.message}` };
  }
}

/** 공통정보 (detailCommon2) — 개요(overview) 텍스트: 음성 가이드·AI 동반자 컨텍스트 */
export async function detail(contentId: string): Promise<{ source: 'TOURAPI' | 'SEED'; overview: string | null; title: string | null; raw?: unknown }> {
  const cached = await prisma.poi.findUnique({ where: { contentId } });
  if (cached?.overview) return { source: cached.source, overview: cached.overview, title: cached.title };
  if (!KEY) return { source: 'SEED', overview: cached?.overview ?? null, title: cached?.title ?? null };
  try {
    const raw = await callTour('detailCommon2', { contentId });
    const it = raw[0];
    const overview: string | null = it?.overview ? String(it.overview).replace(/<[^>]+>/g, '').trim() : null;
    if (cached && overview) await prisma.poi.update({ where: { contentId }, data: { overview, fetchedAt: new Date() } }).catch(() => null);
    return { source: 'TOURAPI', overview, title: it?.title ?? cached?.title ?? null, raw: it ?? null };
  } catch (e) {
    return { source: 'SEED', overview: cached?.overview ?? null, title: cached?.title ?? null };
  }
}

/** 행사·축제 (searchFestival2) — 시즌 한정 코스/메달 자동 생성용. areaCode 4 = 대구 */
export async function festivals(from: Date, areaCode = 4, limit = 20): Promise<{ source: 'TOURAPI' | 'SEED'; items: any[]; error?: string }> {
  const ymd = from.toISOString().slice(0, 10).replace(/-/g, '');
  if (!KEY) return { source: 'SEED', items: [], error: 'TOURAPI_KEY 미설정' };
  try {
    const raw = await callTour('searchFestival2', { eventStartDate: ymd, areaCode, arrange: 'A', numOfRows: limit, pageNo: 1 });
    return { source: 'TOURAPI', items: raw.map((it) => ({ contentId: String(it.contentid), title: it.title, addr1: it.addr1, start: it.eventstartdate, end: it.eventenddate, firstImage: it.firstimage || null, lat: Number(it.mapy), lng: Number(it.mapx) })) };
  } catch (e: any) {
    return { source: 'SEED', items: [], error: e.message };
  }
}

export const tourConfigured = () => Boolean(KEY);
