/**
 * 시드 데이터 — `npm run db:seed` (여러 번 실행해도 안전: slug/code 기준 upsert)
 * 좌표 기준: 수성못 중심 35.8277, 128.6177 (Wikidata). 호수 둘레를 타원으로 근사한 경로이므로
 * 실제 GPX가 나오면 polyline 만 교체하면 된다.
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { cumulative, pointAt, type LatLng } from '../src/lib/geo';

const LAKE = { lat: 35.8277, lng: 128.6177 };
const M_LAT = 111320, M_LNG = 111320 * Math.cos((LAKE.lat * Math.PI) / 180);
const pt = (e: number, n: number): LatLng => [LAKE.lat + n / M_LAT, LAKE.lng + e / M_LNG];
const ell = (deg: number, a = 385, b = 265): LatLng => { const t = (deg * Math.PI) / 180; return pt(a * Math.cos(t), b * Math.sin(t)); };
const arc = (from: number, to: number, step = 4): LatLng[] => { const n = Math.max(1, Math.round(Math.abs(to - from) / step)); const out: LatLng[] = []; for (let i = 0; i <= n; i++) out.push(ell(from + ((to - from) * i) / n)); return out; };
const dedupe = (pts: LatLng[]) => pts.filter((p, i) => i === 0 || Math.abs(p[0] - pts[i - 1][0]) + Math.abs(p[1] - pts[i - 1][1]) > 1e-7);

// 블루런 5K: 시계방향 두 바퀴 + 들안길 스퍼(북쪽 500m) + 북측 호숫가로 복귀
function blueRun() {
  const r: LatLng[] = [];
  r.push(...arc(50, -310));            // 1바퀴
  const lapEnd = r.length - 1;
  r.push(...arc(-310, -585).slice(1)); // 2바퀴 → 북서(135°)
  const nwE = 385 * Math.cos((135 * Math.PI) / 180), nwN = 265 * Math.sin((135 * Math.PI) / 180);
  const spur: LatLng[] = []; for (let i = 1; i <= 12; i++) { const f = i / 12; spur.push(pt(nwE - 40 * Math.sin(f * Math.PI) - 15 * f, nwN + 500 * f)); }
  r.push(...spur);
  const spurTop = r.length - 1;
  r.push(...spur.slice(0, -1).reverse(), ell(135));
  r.push(...arc(135, 50).slice(1));
  const pts = dedupe(r); const cum = cumulative(pts);
  return { pts, cum, total: cum[cum.length - 1], lapEndM: cum[Math.min(lapEnd, cum.length - 1)], spurTopM: cum[Math.min(spurTop, cum.length - 1)], nwE, nwN };
}

async function main() {
  const blue = blueRun();
  const cpAt = (d: number) => pointAt(blue.pts, blue.cum, d);

  // ---------- 코스 ----------
  const courseDefs = [
    {
      slug: 'suseong-blue-5k', name: '수성못 블루런 5K', difficulty: '초중급', themes: ['수변', '야경'], estMinutes: 32, elevationGainM: 12,
      description: '수성못 두 바퀴 + 들안길 스퍼. 수변 데크에서 출발해 상화동산·음악분수를 지나 들안길 먹거리타운을 찍고 야경 피니시.',
      polyline: blue.pts, distanceM: Math.round(blue.total),
      checkpoints: [
        { order: 0, name: '수성못 수변 데크', kind: '출발 · 수변', distM: 0, reward: false, dataSource: '대구 관광코스 CSV · 수성못' },
        { order: 1, name: '수성못길', kind: '러닝 구간', distM: 1000, reward: false, dataSource: '수성구 자전거도로 73건' },
        { order: 2, name: '수성랜드 · 운동 거점', kind: '운동 거점', distM: Math.round(blue.lapEndM), reward: false, dataSource: '수성구 체육시설 615건' },
        { order: 3, name: '무학로 연결 구간', kind: '러닝 구간', distM: 3350, reward: false, dataSource: '수성구 자전거도로 · 무학로' },
        { order: 4, name: '들안로 로컬 구간', kind: '로컬 구간', distM: Math.round(blue.spurTopM), reward: true, dataSource: '수성구 자전거도로 · 들안로' },
        { order: 5, name: '수성못 야경 피니시', kind: '피니시 · 야경', distM: Math.round(blue.total), reward: true, dataSource: '대구 관광코스 CSV · 수성못' },
      ],
    },
    {
      slug: 'suseong-light-3k', name: '수성못 라이트 3K', difficulty: '초급', themes: ['수변'], estMinutes: 19, elevationGainM: 6,
      description: '수성못 한 바퀴 반. 처음 달리는 사람을 위한 평지 코스.',
      polyline: dedupe([...arc(50, -310), ...arc(-310, -490).slice(1)]), distanceM: 0, checkpoints: null,
    },
    {
      slug: 'deuran-food-7k', name: '들안길 미식 러닝 7K', difficulty: '중급', themes: ['미식', '야경'], estMinutes: 45, elevationGainM: 18,
      description: '수성못 세 바퀴 후 들안길 먹거리타운 왕복. 완주 쿠폰 2장.',
      polyline: dedupe([...arc(50, -310), ...arc(-310, -670).slice(1), ...arc(-670, -945).slice(1)]), distanceM: 0, checkpoints: null,
    },
    {
      slug: 'modern-alley-10k', name: '근대로의 질주 10K', difficulty: '중급', themes: ['역사', '골목'], estMinutes: 63, elevationGainM: 55,
      description: '수성못에서 신천을 따라 근대골목까지. 청라언덕·계산성당·약령시·서문시장 체크인. (경로 검증 전 베타)',
      polyline: [[35.8300, 128.6190], [35.8420, 128.6105], [35.8560, 128.6010], [35.8650, 128.5950], [35.8688, 128.5875], [35.8683, 128.5870], [35.8693, 128.5887], [35.8695, 128.5814], [35.8660, 128.5900], [35.8560, 128.6010], [35.8420, 128.6105], [35.8300, 128.6190]] as LatLng[],
      distanceM: 0, checkpoints: null,
    },
  ];
  for (const c of courseDefs) {
    const pts = c.polyline as LatLng[]; const cum = cumulative(pts); const total = Math.round(cum[cum.length - 1]);
    const cps = c.checkpoints
      ? c.checkpoints.map((cp) => { const p = cpAt(cp.distM); return { ...cp, lat: p[0], lng: p[1] }; })
      : (() => { const out = [{ order: 0, name: '출발', kind: '출발', distM: 0, lat: pts[0][0], lng: pts[0][1], reward: false, dataSource: null as string | null }]; let n = 1; for (let d = 1000; d < total - 200; d += 1000) { const p = pointAt(pts, cum, d); out.push({ order: n++, name: `체크포인트 ${n - 1}`, kind: '러닝 구간', distM: d, lat: p[0], lng: p[1], reward: false, dataSource: null }); } out.push({ order: n, name: '피니시', kind: '피니시', distM: total, lat: pts[pts.length - 1][0], lng: pts[pts.length - 1][1], reward: true, dataSource: null }); return out; })();
    await prisma.course.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description, distanceM: total, difficulty: c.difficulty, themes: c.themes, startLat: pts[0][0], startLng: pts[0][1], polyline: pts, elevationGainM: c.elevationGainM, estMinutes: c.estMinutes, source: 'OFFICIAL', checkpoints: { create: cps } },
      update: { name: c.name, description: c.description, distanceM: total, themes: c.themes, polyline: pts, estMinutes: c.estMinutes },
    });
  }
  const blueCourse = await prisma.course.findUniqueOrThrow({ where: { slug: 'suseong-blue-5k' } });

  // ---------- POI (TourAPI locationBasedList2 형식의 시드 — 키가 생기면 실데이터로 덮임) ----------
  const poiDefs = [
    { contentId: 'seed-sanghwa', contentTypeId: 12, title: '상화동산', addr1: '대구광역시 수성구 두산동', ll: ell(5, 345, 235), distM: 260, voice: '상화동산. 민족시인 이상화를 기리는 수변 공원입니다. 잠시 속도를 늦추고 호수 풍경을 즐겨 보세요.', overview: '민족시인 이상화를 기리는 수변 공원. 수성못 동편 산책로와 이어진다.' },
    { contentId: 'seed-fountain', contentTypeId: 14, title: '수성못 음악분수', addr1: '대구광역시 수성구 두산동 수성못', ll: ell(-75, 345, 235), distM: 720, voice: '수성못 음악분수. 저녁이면 음악에 맞춰 분수 쇼가 열리는 야경 포인트입니다.', overview: '저녁마다 음악에 맞춰 분수가 춤추는 수성못의 대표 야경 포인트.' },
    { contentId: 'seed-duckboat', contentTypeId: 28, title: '수성못 오리배 선착장', addr1: '대구광역시 수성구 용학로', ll: ell(190, 345, 235), distM: 1380, voice: '오리배 선착장을 지나고 있습니다. 러닝 후에는 수성못의 상징, 오리배도 즐겨 보세요.', overview: '수성못의 상징 오리배. 러닝 후 가족과 함께 타기 좋은 수상 레포츠.' },
    { contentId: 'seed-cafe', contentTypeId: 39, title: '수성못 카페거리', addr1: '대구광역시 수성구 용학로 일대', ll: ell(-160, 430, 300), distM: 3280, voice: '수성못 카페거리입니다. 완주 후 리커버리 커피 한 잔 어떠세요.', overview: '호수를 바라보는 카페가 모인 거리. 완주 후 리커버리 커피 한 잔.' },
    { contentId: 'seed-deuran', contentTypeId: 39, title: '들안길 먹거리타운', addr1: '대구광역시 수성구 들안로 일대', ll: pt(blue.nwE - 45, blue.nwN + 400), distM: 4050, voice: '들안길 먹거리타운에 도착했습니다. 완주하면 이곳 제휴 매장 쿠폰이 발급됩니다.', overview: '대구 대표 미식 거리. 완주 쿠폰을 쓸 수 있는 제휴 후보 매장이 모여 있다.' },
  ];
  for (const p of poiDefs) {
    const poi = await prisma.poi.upsert({ where: { contentId: p.contentId }, create: { contentId: p.contentId, contentTypeId: p.contentTypeId, title: p.title, addr1: p.addr1, lat: p.ll[0], lng: p.ll[1], overview: p.overview, source: 'SEED' }, update: { title: p.title, lat: p.ll[0], lng: p.ll[1], overview: p.overview } });
    await prisma.coursePoi.upsert({ where: { courseId_poiId: { courseId: blueCourse.id, poiId: poi.id } }, create: { courseId: blueCourse.id, poiId: poi.id, distFromStartM: p.distM, voice: p.voice }, update: { distFromStartM: p.distM, voice: p.voice } });
  }

  // ---------- 메달 · 챌린지 ----------
  const medals = [
    { code: 'M-GEUMHO', name: '금호강 새벽 강바람', description: '금호강 코스 완주 메달', courseSlug: 'geumho-dawn-10k' },
    { code: 'M-MODERN', name: '근대로의 질주', description: '근대골목 코스 완주 메달', courseSlug: 'modern-alley-10k' },
    { code: 'M-SUSEONG', name: '수성 블루러너', description: '수성못 수변·야경 코스 완주 · 시즌 한정 디자인', courseSlug: 'suseong-blue-5k', seasonCode: '2026-AUTUMN' },
    { code: 'M-APSAN', name: '앞산 야경 러너', description: '앞산·83타워 야경 코스 완주 메달', courseSlug: 'apsan-night-8k' },
    { code: 'M-CHILSEONG', name: '칠성·공구골목 탐험가', description: '칠성시장·공구골목 코스 완주 메달', courseSlug: 'chilseong-tools-7k' },
    { code: 'M-DEURAN', name: '들안길 미식 러너', description: '들안길 미식 러닝 완주 메달', courseSlug: 'deuran-food-7k' },
  ];
  for (const m of medals) await prisma.medal.upsert({ where: { code: m.code }, create: m, update: { name: m.name, description: m.description, courseSlug: m.courseSlug } });
  await prisma.challenge.upsert({ where: { code: 'DAEGU-5' }, create: { code: 'DAEGU-5', name: '대구 5대 코스 정복', description: '5개 코스를 완주하고 한정 메달을 모으세요', targetCount: 5, courseSlugs: ['geumho-dawn-10k', 'modern-alley-10k', 'suseong-blue-5k', 'apsan-night-8k', 'chilseong-tools-7k'] }, update: {} });

  // ---------- 가맹 후보 매장 · 쿠폰 ----------
  const merchantDefs = [
    { key: 'deuran-food', name: '들안길 먹거리타운 제휴 후보 매장', category: '음식점', ll: pt(blue.nwE - 45, blue.nwN + 400), addr: '대구 수성구 들안로 일대', coupon: { title: '들안길 먹거리타운 5,000원 할인', discountKrw: 5000, courseSlug: 'suseong-blue-5k' } },
    { key: 'seomun-cafe', name: '서문시장 카페', category: '카페', ll: [35.8695, 128.5814] as LatLng, addr: '대구 중구 큰장로', coupon: { title: '아메리카노 무료', discountKrw: 4500, courseSlug: 'modern-alley-10k' } },
    { key: 'suseong-cafe', name: '수성못 카페거리 제휴 후보 카페', category: '카페', ll: ell(-160, 430, 300), addr: '대구 수성구 용학로', coupon: { title: '리커버리 커피 10% 할인', discountKrw: 500, courseSlug: 'deuran-food-7k' } },
  ];
  for (const m of merchantDefs) {
    let merchant = await prisma.merchant.findFirst({ where: { name: m.name } });
    if (!merchant) merchant = await prisma.merchant.create({ data: { name: m.name, category: m.category, lat: m.ll[0], lng: m.ll[1], addr: m.addr } });
    const exists = await prisma.coupon.findFirst({ where: { merchantId: merchant.id, title: m.coupon.title } });
    if (!exists) await prisma.coupon.create({ data: { merchantId: merchant.id, title: m.coupon.title, discountKrw: m.coupon.discountKrw, courseSlug: m.coupon.courseSlug, validUntil: new Date(Date.now() + 90 * 86400000) } });
  }

  // ---------- 미션 (이번 달) ----------
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const missionDefs = [
    { code: 'MONTH-30K', type: 'PERIOD_DISTANCE', title: '이달의 30km', description: '이번 달 누적 30km 달리기', rule: { targetM: 30000 }, rewardText: '월간 배지' },
    { code: 'MIRACLE-3', type: 'MIRACLE_RUN', title: '미라클 런 3회', description: '오전 5~8시 출발 러닝 3회', rule: { startHourFrom: 5, startHourTo: 8, count: 3 }, rewardText: '미라클 배지' },
    { code: 'BLUE-CHECKIN', type: 'CHECKIN', title: '수성못 블루런 체크포인트 올클리어', description: '블루런 5K 체크포인트 6곳 모두 체크인', rule: { courseSlug: 'suseong-blue-5k', count: 1 }, rewardText: '수성 블루러너 메달' },
    { code: 'LOCAL-FOOD-1', type: 'LOCAL_FOOD', title: '로컬 맛집 인증', description: '완주 후 가맹 후보 매장에서 사진+위치 인증', rule: { count: 1 }, rewardText: '추가 쿠폰' },
  ] as const;
  for (const m of missionDefs) await prisma.mission.upsert({ where: { code: m.code }, create: { code: m.code, type: m.type, title: m.title, description: m.description, periodStart: start, periodEnd: end, rule: m.rule, rewardText: m.rewardText }, update: { periodStart: start, periodEnd: end, rule: m.rule } });

  // ---------- 운영 계정 · 대회 · 크루 · 메이트 ----------
  const ops = await prisma.user.upsert({ where: { deviceId: 'seed-ops' }, create: { deviceId: 'seed-ops', nickname: '로컬스트라이드', avatarColor: '#E4B23A' }, update: {} });
  const eventStart = new Date(now.getFullYear(), now.getMonth() + 1, 15, 8, 0, 0);
  await prisma.event.upsert({ where: { slug: '3km-challenge' }, create: { slug: '3km-challenge', title: '로컬 스트라이드 3KM CHALLENGE', description: '수성못 3km 러닝 챌린지. 라이브 랭킹 전광판·MY RECORD 카드 제공. (날짜는 확정 후 수정)', courseId: (await prisma.course.findUnique({ where: { slug: 'suseong-light-3k' } }))!.id, startsAt: eventStart, capacity: 200, feeKrw: 0, tshirt: true, status: 'OPEN' }, update: {} });
  let crew = await prisma.crew.findFirst({ where: { name: '수성못 아침 크루' } });
  if (!crew) crew = await prisma.crew.create({ data: { name: '수성못 아침 크루', description: '평일 아침 6시 반, 수성못 한 바퀴. 초보 환영, 페이스 6~8분.', lifestyle: ['아침', '초보환영', '직장인'], paceMinSec: 360, paceMaxSec: 480, area: '대구 수성구', ownerId: ops.id, members: { create: { userId: ops.id, role: 'OWNER' } }, runs: { create: { courseId: blueCourse.id, startsAt: new Date(now.getTime() + 2 * 86400000), note: '수변 데크 앞 집결' } } } });
  const post = await prisma.matePost.findFirst({ where: { authorId: ops.id } });
  if (!post) await prisma.matePost.create({ data: { authorId: ops.id, type: 'PACEMAKER', paceSec: 372, meetAt: new Date(now.getTime() + 3 * 86400000), place: '수성못 수변 데크', slots: 6, body: "6'12\" 페이스로 블루런 5K 같이 달릴 페이스메이커 모집" } });

  console.log(`seeded: blue run ${(blue.total / 1000).toFixed(2)}km, courses ${courseDefs.length}, pois ${poiDefs.length}, medals ${medals.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
