export interface DaeguArea {
  slug: string;
  name: string;
  fullName: string;
  hub: string;
  lat: number;
  lng: number;
  themes: string[];
  summary: string;
  image: string;
  communityReady: boolean;
  runCourseSlug?: string;
}

export const DAEGU_AREAS: DaeguArea[] = [
  { slug: 'suseong', name: '수성구', fullName: '대구 수성구', hub: '수성못', lat: 35.8277, lng: 128.6177, themes: ['수변', '야경', '미식'], summary: '수성못과 들안길을 잇는 수변·미식 러닝', image: '/images/local/suseong-lake-blue-run.jpg', communityReady: true, runCourseSlug: 'suseong-blue-5k' },
  { slug: 'jung', name: '중구', fullName: '대구 중구', hub: '청라언덕', lat: 35.8685, lng: 128.5827, themes: ['역사', '골목', '문화'], summary: '청라언덕과 근대골목을 이야기로 잇는 도심 러닝', image: '/images/local/modern-alley-morning-run.jpg', communityReady: true },
  { slug: 'dong', name: '동구', fullName: '대구 동구', hub: '동촌유원지', lat: 35.8864, lng: 128.6512, themes: ['수변', '가족', '초보'], summary: '동촌유원지와 금호강을 따라가는 평지 러닝', image: '/images/local/sincheon-riverside-run.jpg', communityReady: true },
  { slug: 'seo', name: '서구', fullName: '대구 서구', hub: '이현공원', lat: 35.8726, lng: 128.5454, themes: ['공원', '일상', '초보'], summary: '이현공원과 생활권 녹지를 활용하는 일상 러닝', image: '/images/local/local-reward-checkin.jpg', communityReady: false },
  { slug: 'nam', name: '남구', fullName: '대구 남구', hub: '앞산빨래터공원', lat: 35.8344, lng: 128.5807, themes: ['트레일', '자연', '전망'], summary: '앞산 자락에서 호흡과 안전을 우선하는 트레일', image: '/images/local/apsan-trail-run.jpg', communityReady: true },
  { slug: 'buk', name: '북구', fullName: '대구 북구', hub: '금호강 침산교', lat: 35.8954, lng: 128.5851, themes: ['수변', '롱런', '아침'], summary: '금호강 강바람을 따라 거리를 늘리는 롱런', image: '/images/local/sincheon-riverside-run.jpg', communityReady: true },
  { slug: 'dalseo', name: '달서구', fullName: '대구 달서구', hub: '월광수변공원', lat: 35.8028, lng: 128.5288, themes: ['수변', '저녁', '초보'], summary: '월광수변공원을 중심으로 여유롭게 달리는 저녁 런', image: '/images/local/suseong-lake-blue-run.jpg', communityReady: true },
  { slug: 'dalseong', name: '달성군', fullName: '대구 달성군', hub: '사문진나루터', lat: 35.8118, lng: 128.4783, themes: ['강변', '역사', '여행'], summary: '사문진과 낙동강을 연결하는 강변 러닝 권역', image: '/images/local/sincheon-riverside-run.jpg', communityReady: false },
  { slug: 'gunwi', name: '군위군', fullName: '대구 군위군', hub: '삼국유사테마파크', lat: 36.1194, lng: 128.7215, themes: ['자연', '여행', '로컬'], summary: '군위의 넓은 자연과 로컬 이야기를 만나는 여행형 런', image: '/images/local/apsan-trail-run.jpg', communityReady: false },
];

export const DEFAULT_DAEGU_AREA = DAEGU_AREAS[0];
export const DAEGU_AREA_STORAGE_KEY = 'localstride_daegu_area';
export const daeguAreaByName = (value?: string | null) => DAEGU_AREAS.find((area) => area.name === value || area.fullName === value || area.slug === value) ?? DEFAULT_DAEGU_AREA;

export function daeguAreaFromText(value?: string | null): DaeguArea | null {
  const text = value || '';
  const named = DAEGU_AREAS.find((area) => text.includes(area.name));
  if (named) return named;
  if (/수성못|수성교|들안길|두산오거리/.test(text)) return daeguAreaByName('수성구');
  if (/월광|성당못/.test(text)) return daeguAreaByName('달서구');
  if (/청라언덕|근대골목|서문시장|동성로|약령시/.test(text)) return daeguAreaByName('중구');
  if (/동촌유원지|팔공산|아양교/.test(text)) return daeguAreaByName('동구');
  if (/이현공원|그린웨이/.test(text)) return daeguAreaByName('서구');
  if (/앞산|빨래터|신천/.test(text)) return daeguAreaByName('남구');
  if (/침산교|금호강|하중도/.test(text)) return daeguAreaByName('북구');
  if (/사문진|화원유원지|낙동강/.test(text)) return daeguAreaByName('달성군');
  if (/삼국유사|군위/.test(text)) return daeguAreaByName('군위군');
  return null;
}

export const DAEGU_AREA_OPTIONS = DAEGU_AREAS.map((area) => area.fullName);

const toRadians = (value: number) => value * Math.PI / 180;
export function distanceKmBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function nearestDaeguArea(lat: number, lng: number) {
  return DAEGU_AREAS.map((area) => ({ area, distanceKm: distanceKmBetween(lat, lng, area.lat, area.lng) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
}

export function daeguAreaFromCourse(course: { slug: string; areaName?: string | null; name: string; description?: string | null }) {
  if (course.slug.includes('modern-alley')) return daeguAreaByName('중구');
  return daeguAreaFromText(`${course.areaName || ''} ${course.name} ${course.description || ''}`);
}
