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
  const ops = await prisma.user.upsert({
    where: { deviceId: 'seed-ops' },
    create: { deviceId: 'seed-ops', nickname: '로컬스트라이드 호스트', avatarColor: '#E4B23A', bio: '대구의 숨은 러닝 코스를 함께 달리는 LOCAL STRIDE 로컬 호스트', homeArea: '대구 수성구', preferredPaceSec: 390 },
    update: { nickname: '로컬스트라이드 호스트', bio: '대구의 숨은 러닝 코스를 함께 달리는 LOCAL STRIDE 로컬 호스트', homeArea: '대구 수성구', preferredPaceSec: 390 },
  });
  const lightCourse = await prisma.course.findUniqueOrThrow({ where: { slug: 'suseong-light-3k' } });
  const foodCourse = await prisma.course.findUniqueOrThrow({ where: { slug: 'deuran-food-7k' } });
  const modernCourse = await prisma.course.findUniqueOrThrow({ where: { slug: 'modern-alley-10k' } });
  const nextAt = (days: number, hour: number, minute = 0) => {
    const kstNow = new Date(now.getTime() + 9 * 60 * 60_000);
    return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate() + days, hour - 9, minute, 0));
  };
  await prisma.event.upsert({
    where: { slug: '3km-challenge' },
    create: { slug: '3km-challenge', title: '로컬 스트라이드 3KM CHALLENGE', description: '수성못 3km 러닝 챌린지. 라이브 랭킹 전광판·MY RECORD 카드 제공. (날짜는 확정 후 수정)', courseId: lightCourse.id, startsAt: nextAt(31, 8), capacity: 200, feeKrw: 0, tshirt: true, status: 'OPEN' },
    update: {},
  });

  const demoRunnerDefs = [
    { deviceId: 'seed-community-dawn', nickname: '새벽물결', avatarColor: '#2F6FED', bio: '수성못 새벽 공기를 좋아해요.', homeArea: '대구 수성구', preferredPaceSec: 410 },
    { deviceId: 'seed-community-deuran', nickname: '들안길토끼', avatarColor: '#F28C28', bio: '퇴근 후 미식런을 즐기는 직장인 러너예요.', homeArea: '대구 수성구', preferredPaceSec: 380 },
    { deviceId: 'seed-community-sincheon', nickname: '신천바람', avatarColor: '#14A38B', bio: '신천 야경과 함께 가병게 달립니다.', homeArea: '대구 남구', preferredPaceSec: 360 },
    { deviceId: 'seed-community-apsan', nickname: '앞산호흡', avatarColor: '#6B53D5', bio: '주말에는 앞산 트레일, 평일에는 시내 조깅.', homeArea: '대구 남구', preferredPaceSec: 430 },
    { deviceId: 'seed-community-dalseo', nickname: '달서페이스', avatarColor: '#E4556C', bio: '천천히 길게 달리는 것을 좋아해요.', homeArea: '대구 달서구', preferredPaceSec: 450 },
    { deviceId: 'seed-community-cheongna', nickname: '청라러너', avatarColor: '#D69A13', bio: '대구 골목의 이야기를 찾아 달립니다.', homeArea: '대구 중구', preferredPaceSec: 400 },
    { deviceId: 'seed-community-geumho', nickname: '금호강롱런', avatarColor: '#1677C8', bio: '일요일 금호강 롱런 파트너를 찾고 있어요.', homeArea: '대구 북구', preferredPaceSec: 390 },
    { deviceId: 'seed-community-starlight', nickname: '수성별빛', avatarColor: '#8C5AE8', bio: '수성못 선셋과 야간 러닝을 좋아해요.', homeArea: '대구 수성구', preferredPaceSec: 420 },
    { deviceId: 'seed-community-first5k', nickname: '대구첫런', avatarColor: '#37A66C', bio: '5K 완주를 목표로 천천히 달리는 중입니다.', homeArea: '대구 동구', preferredPaceSec: 480 },
    { deviceId: 'seed-community-downtown', nickname: '동성로질주', avatarColor: '#EF6C45', bio: '퇴근런과 번개런이면 언제든 환영이에요.', homeArea: '대구 중구', preferredPaceSec: 370 },
  ];
  const demoRunners = [];
  for (const runner of demoRunnerDefs) demoRunners.push(await prisma.user.upsert({
    where: { deviceId: runner.deviceId },
    create: runner,
    update: { nickname: runner.nickname, avatarColor: runner.avatarColor, bio: runner.bio, homeArea: runner.homeArea, preferredPaceSec: runner.preferredPaceSec },
  }));
  const programDefs = [
    { slug: 'suseong-morning-run', title: '수성못 모닝 블루런', description: '대구 로컬 호스트와 수성못의 아침을 여는 초보 환영 3K 러닝입니다.', kind: 'MORNING' as const, place: '수성못 수변 데크', paceSec: 420, courseId: lightCourse.id, startsAt: nextAt(2, 6, 30), capacity: 12, feeKrw: 0 },
    { slug: 'deuran-after-work-run', title: '들안길 퇴근 미식런', description: '퇴근 후 수성못에서 출발해 들안길의 야경과 로컬 미식 거리를 만나는 7K 러닝입니다.', kind: 'AFTER_WORK' as const, place: '수성못 상화동산 입구', paceSec: 390, courseId: foodCourse.id, startsAt: nextAt(4, 19, 30), capacity: 10, feeKrw: 5000 },
    { slug: 'daegu-independent-theme-run', title: '대구 골목 독립런', description: '근대골목의 이야기를 따라 달리는 월간 주제형 러닝. 혼자 와도 로컬 러너와 함께 시작합니다.', kind: 'THEME' as const, place: '청라언덕 선교사 주택 앞', paceSec: 420, courseId: modernCourse.id, startsAt: nextAt(8, 9), capacity: 16, feeKrw: 10000 },
  ];
  for (const program of programDefs) await prisma.event.upsert({
    where: { slug: program.slug },
    create: { ...program, hostId: ops.id, status: 'OPEN', tshirt: false },
    update: {},
  });

  const raceDefs = [
    { slug: 'suseong-sunset-5k-preview', title: '수성못 선셋 5K · PREVIEW', description: '[MVP 시범 대회] 수성못의 노을과 음악분수를 지나는 초보 환영 런. 실제 일정과 혜택은 운영 확정 후 공개됩니다.', place: '수성못 상화동산 입구', courseId: blueCourse.id, startsAt: nextAt(17, 18, 30), capacity: 180, feeKrw: 12000, tshirt: true, entrants: [0, 1, 2, 7, 8, 9] },
    { slug: 'deuran-night-7k-preview', title: '들안길 나이트 7K · PREVIEW', description: '[MVP 시범 대회] 수성못에서 출발해 들안길 로컬 상권과 연결하는 야경 런. 제휴 쿠폰은 시범 운영 후 확정합니다.', place: '수성못 두산오거리 광장', courseId: foodCourse.id, startsAt: nextAt(24, 19, 30), capacity: 120, feeKrw: 18000, tshirt: false, entrants: [1, 2, 4, 5, 7, 9] },
    { slug: 'daegu-alley-10k-preview', title: '대구 골목 10K · PREVIEW', description: '[MVP 시범 대회] 청라언덕·계산성당·약령시를 이야기로 잇는 대구 로컬 히스토리 런. 코스 안전 검증 후 정식 오픈합니다.', place: '청라언덕 선교사 주택 앞', courseId: modernCourse.id, startsAt: nextAt(38, 8, 30), capacity: 250, feeKrw: 25000, tshirt: true, entrants: [0, 2, 3, 5, 6, 9] },
    { slug: 'suseong-family-3k-preview', title: '수성못 패밀리 3K · PREVIEW', description: '[MVP 시범 대회] 첫 러너와 가족이 함께 달리는 수성못 평지 코스. 행사 신고·안전 요원 확보 후 정식 접수합니다.', place: '수성못 수변 데크', courseId: lightCourse.id, startsAt: nextAt(45, 9), capacity: 100, feeKrw: 5000, tshirt: false, entrants: [3, 4, 7, 8] },
  ];
  for (const race of raceDefs) {
    const { entrants, ...data } = race;
    const event = await prisma.event.upsert({
      where: { slug: race.slug },
      create: { ...data, kind: 'RACE', hostId: ops.id, status: 'OPEN' },
      update: {},
    });
    for (let entrantIndex = 0; entrantIndex < entrants.length; entrantIndex += 1) {
      const runner = demoRunners[entrants[entrantIndex]];
      await prisma.eventRegistration.upsert({
        where: { eventId_userId: { eventId: event.id, userId: runner.id } },
        create: { eventId: event.id, userId: runner.id, bib: 101 + entrantIndex, tshirtSize: race.tshirt ? ['S', 'M', 'L'][entrantIndex % 3] : null, paid: race.feeKrw === 0 },
        update: {},
      });
    }
  }

  const crewDefs = [
    { name: '수성못 아침 크루', description: '[MVP 시범 크루] 평일 아침 6시 반, 수성못 한 바퀴. 첫 러너도 쉽게 함께해요.', lifestyle: ['아침', '초보환영', '직장인'], paceMinSec: 390, paceMaxSec: 480, area: '대구 수성구', ownerIndex: 0, members: [1, 7, 8], courseId: lightCourse.id, startsAt: nextAt(2, 6, 30), note: '[시범] 상화동산 입구 집결 · 스트레칭 10분' },
    { name: '신천 퇴근 러너스', description: '[MVP 시범 크루] 퇴근 후 신천 야경을 따라 5~7K를 달리는 직장인 크루예요.', lifestyle: ['저녁', '직장인'], paceMinSec: 340, paceMaxSec: 420, area: '대구 남구', ownerIndex: 2, members: [1, 5, 9], courseId: blueCourse.id, startsAt: nextAt(3, 19, 40), note: '[시범] 신천 수성교 하부 집결 · 6K 복귀 코스' },
    { name: '앞산 주말 트레일', description: '[MVP 시범 크루] 등산로 입구부터 천천히 오르며 안전과 호흡을 우선하는 트레일 모임입니다.', lifestyle: ['주말'], paceMinSec: 420, paceMaxSec: 600, area: '대구 남구', ownerIndex: 3, members: [0, 4, 6], courseId: null, startsAt: nextAt(5, 8), note: '[시범] 앞산빨래터 입구 집결 · 안전 장비 필수' },
    { name: '대구 초보 5K 클럽', description: '[MVP 시범 크루] 걷기와 달리기를 반복하며 첫 5K 완주를 함께 준비해요.', lifestyle: ['초보환영', '주말'], paceMinSec: 450, paceMaxSec: 600, area: '대구 동구', ownerIndex: 8, members: [0, 4, 7], courseId: lightCourse.id, startsAt: nextAt(6, 9, 30), note: '[시범] 동촌유원지 광장 집결 · 런워 40분' },
    { name: '달서 나이트 스트라이드', description: '[MVP 시범 크루] 월광수변공원을 중심으로 진행하는 여유로운 저녁 런입니다.', lifestyle: ['저녁', '초보환영', '직장인'], paceMinSec: 400, paceMaxSec: 510, area: '대구 달서구', ownerIndex: 4, members: [2, 8, 9], courseId: lightCourse.id, startsAt: nextAt(4, 20), note: '[시범] 월광수변공원 주차장 옆 집결 · 4K 조깅' },
    { name: '금호강 롱런 클럽', description: '[MVP 시범 크루] 일요일 아침 금호강 강바람을 맞으며 10K 이상을 함께 달려요.', lifestyle: ['아침', '주말'], paceMinSec: 350, paceMaxSec: 430, area: '대구 북구', ownerIndex: 6, members: [1, 2, 3, 5], courseId: modernCourse.id, startsAt: nextAt(7, 7), note: '[시범] 침산교 하부 집결 · 보급수 준비' },
  ];
  for (const definition of crewDefs) {
    let crew = await prisma.crew.findFirst({ where: { name: definition.name } });
    if (!crew) crew = await prisma.crew.create({
      data: { name: definition.name, description: definition.description, lifestyle: definition.lifestyle, paceMinSec: definition.paceMinSec, paceMaxSec: definition.paceMaxSec, area: definition.area, ownerId: demoRunners[definition.ownerIndex].id },
    });
    if (crew.description === '평일 아침 6시 반, 수성못 한 바퀴. 초보 환영, 페이스 6~8분.') crew = await prisma.crew.update({ where: { id: crew.id }, data: { description: definition.description } });
    await prisma.crewMember.upsert({ where: { crewId_userId: { crewId: crew.id, userId: crew.ownerId } }, create: { crewId: crew.id, userId: crew.ownerId, role: 'OWNER' }, update: {} });
    for (const memberIndex of definition.members) {
      const runner = demoRunners[memberIndex];
      if (runner.id !== crew.ownerId) await prisma.crewMember.upsert({ where: { crewId_userId: { crewId: crew.id, userId: runner.id } }, create: { crewId: crew.id, userId: runner.id }, update: {} });
    }
    const scheduled = await prisma.crewRun.findFirst({ where: { crewId: crew.id, note: definition.note } });
    if (!scheduled) await prisma.crewRun.create({ data: { crewId: crew.id, courseId: definition.courseId, startsAt: definition.startsAt, note: definition.note } });
    else if (scheduled.startsAt < now) await prisma.crewRun.update({ where: { id: scheduled.id }, data: { startsAt: definition.startsAt } });
  }

  const mateDefs = [
    { authorIndex: 0, type: 'PACEMAKER' as const, paceSec: 410, meetAt: nextAt(2, 6, 30), place: '수성못 상화동산 입구', slots: 5, body: '[시범 모집] 첫 5K 완주를 위한 6\'50\" 안정 페이싱', applicants: [7, 8] },
    { authorIndex: 1, type: 'MATE' as const, paceSec: 385, meetAt: nextAt(3, 19, 30), place: '들안길 두산오거리', slots: 4, body: '[시범 모집] 퇴근 후 6K 달리고 로컬 식당에서 가병게 식사해요', applicants: [2, 9] },
    { authorIndex: 2, type: 'PACEMAKER' as const, paceSec: 360, meetAt: nextAt(4, 20), place: '신천 수성교 하부', slots: 6, body: '[시범 모집] 신천 야경 7K, 6\'00\" 페이스를 맞춰드려요', applicants: [1, 5, 7] },
    { authorIndex: 3, type: 'MATE' as const, paceSec: 480, meetAt: nextAt(5, 8), place: '앞산빨래터 입구', slots: 5, body: '[시범 모집] 러닝과 등산 사이, 안전하게 새벽 트레일 함께해요', applicants: [4, 6] },
    { authorIndex: 4, type: 'MATE' as const, paceSec: 450, meetAt: nextAt(4, 20), place: '월광수변공원 정문', slots: 4, body: '[시범 모집] 대화 가능한 7\'30\" 페이스로 4K 조깅해요', applicants: [8] },
    { authorIndex: 5, type: 'PACEMAKER' as const, paceSec: 400, meetAt: nextAt(6, 9), place: '청라언덕 서축정원', slots: 8, body: '[시범 모집] 근대골목 이야기를 들으며 달리는 로컬 스토리 런', applicants: [0, 3, 9] },
    { authorIndex: 6, type: 'PACEMAKER' as const, paceSec: 390, meetAt: nextAt(7, 7), place: '금호강 침산교 하부', slots: 6, body: '[시범 모집] 일요일 12K 롱런, 마지막 2K만 속도를 올려요', applicants: [1, 2, 3] },
    { authorIndex: 8, type: 'MATE' as const, paceSec: 500, meetAt: nextAt(6, 10), place: '동촌유원지 광장', slots: 3, body: '[시범 모집] 러닝을 처음 시작한 분끼리 3K 런워크로 달려요', applicants: [0] },
  ];
  for (const definition of mateDefs) {
    const author = demoRunners[definition.authorIndex];
    let post = await prisma.matePost.findFirst({ where: { authorId: author.id, body: definition.body } });
    if (!post) post = await prisma.matePost.create({ data: { authorId: author.id, type: definition.type, paceSec: definition.paceSec, meetAt: definition.meetAt, place: definition.place, slots: definition.slots, body: definition.body } });
    else if (post.meetAt < now) post = await prisma.matePost.update({ where: { id: post.id }, data: { meetAt: definition.meetAt, status: 'OPEN' } });
    for (const applicantIndex of definition.applicants) await prisma.mateApplication.upsert({
      where: { postId_userId: { postId: post.id, userId: demoRunners[applicantIndex].id } },
      create: { postId: post.id, userId: demoRunners[applicantIndex].id },
      update: {},
    });
  }

  console.log(`seeded: blue run ${(blue.total / 1000).toFixed(2)}km, courses ${courseDefs.length}, crews ${crewDefs.length}, mates ${mateDefs.length}, races ${raceDefs.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
