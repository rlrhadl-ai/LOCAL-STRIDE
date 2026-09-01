'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import BannerCarousel from '@/components/BannerCarousel';
import { useDaeguArea } from '@/components/DaeguAreaProvider';
import LiveBadge from '@/components/LiveBadge';
import { api, mediaUrl } from '@/lib/api';
import { DAEGU_AREAS, daeguAreaFromCourse, daeguAreaFromText } from '@/lib/daegu-areas';
import type { Course, HomeBanner, NearbyResult, PartnerOffer, Recommendation, RunProgram } from '@/lib/types';

const PROGRAM_KIND: Record<RunProgram['kind'], string> = {
  MORNING: '아침런', AFTER_WORK: '퇴근런', INDEPENDENT: '독립런', THEME: '주제형 러닝', POPUP: '번개런',
};
const COURSE_THEMES = ['수변', '야경', '미식', '역사', '골목'];

function PartnerGlyph() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden><path d="M11 32c5-2 7-6 8-13 4 6 8 9 18 10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><path d="M12 35h25" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><circle cx="31" cy="16" r="4" fill="currentColor"/></svg>;
}
export default function Home() {
  const { area, ready, setAreaSlug, locateNearest } = useDaeguArea();
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [partners, setPartners] = useState<PartnerOffer[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [programs, setPrograms] = useState<RunProgram[]>([]);
  const [locationState, setLocationState] = useState<'idle' | 'loading'>('idle');
  const [locationMessage, setLocationMessage] = useState('');
  const [quickDistance, setQuickDistance] = useState(5);
  const [quickMode, setQuickMode] = useState<'solo' | 'together'>('solo');
  const selectedAreaRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<{ items: Course[] }>('/courses').then((result) => alive && setCourses(result.items)).catch(() => undefined);
    api.get<{ items: RunProgram[] }>('/programs?limit=3').then((result) => alive && setPrograms(result.items)).catch(() => undefined);
    api.get<{ items: PartnerOffer[] }>('/partners').then((result) => alive && setPartners(result.items)).catch(() => undefined);
    api.get<{ items: HomeBanner[] }>('/banners').then((result) => alive && setBanners(result.items)).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let alive = true; setRec(null); setNearby(null);
    api.get<Recommendation>(`/recommend?km=5&themes=${encodeURIComponent(area.themes.slice(0, 2).join(','))}&lat=${area.lat}&lng=${area.lng}`).then((result) => alive && setRec(result)).catch(() => undefined);
    api.get<NearbyResult>(`/tour/nearby?lat=${area.lat}&lng=${area.lng}&radius=5000&limit=12`).then((result) => alive && setNearby(result)).catch(() => undefined);
    return () => { alive = false; };
  }, [area, ready]);
  useEffect(() => {
    if (!ready) return;
    selectedAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [area.slug, ready]);

  const nextProgram = programs.find((program) => daeguAreaFromText(`${program.place || ''} ${program.title} ${program.description}`)?.name === area.name);
  const best = rec?.best?.course;
  const bestCourse = best ? courses.find((course) => course.id === best.id) : null;
  const localCourses = courses.filter((course) => daeguAreaFromCourse(course)?.name === area.name);
  const localBestCourse = bestCourse && daeguAreaFromCourse(bestCourse)?.name === area.name ? bestCourse : null;
  const featuredCourses = (localBestCourse ? [localBestCourse, ...localCourses.filter((course) => course.id !== localBestCourse.id)] : localCourses).slice(0, 2);
  const attraction = (nearby?.items ?? []).find((item) => [12, 14, 28].includes(item.contentTypeId));
  const featuredPartner = partners.find((partner) => partner.name === '러너스데이') ?? partners.find((partner) => partner.name.includes('러너스테이')) ?? partners[0];
  const weather = rec?.weather;
  const runHref = area.runCourseSlug ? `/run/${area.runCourseSlug}` : `/spots?area=${area.slug}`;
  const quickTheme = area.themes.find((theme) => COURSE_THEMES.includes(theme)) || '수변';
  const quickHref = quickMode === 'solo'
    ? `/courses?area=${area.slug}&km=${quickDistance}&theme=${encodeURIComponent(quickTheme)}`
    : `/mates?area=${area.slug}&distance=${quickDistance}`;

  const findMyArea = async () => {
    setLocationState('loading'); setLocationMessage('현재 위치를 확인하고 있어요.');
    try {
      const nearest = await locateNearest();
      setLocationMessage(`현재 위치에서 가장 가까운 러닝 거점을 ${nearest.area.hub}로 설정했어요 · 약 ${nearest.distanceKm.toFixed(1)}km`);
    } catch (error) { setLocationMessage(error instanceof Error ? error.message : '현재 위치를 확인하지 못했어요.'); }
    finally { setLocationState('idle'); }
  };

  return <main className="page home-page">
    <AppHeader right={<Link href="/me" className="icon-btn" aria-label="마이"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></Link>} />

    <section className="home-hero">
      <div className="home-hero-meta"><span>DAEGU BORN · RUN TOGETHER</span><b>{weather ? `${weather.temp}° · ${weather.sky}` : '대구 러너 에디션'} · {area.name}</b></div>
      <h1>대구의 길을<br/><em>대구 사람과 달려요.</em></h1>
      <p>내 위치나 선택한 지역을 기준으로 코스를 찾고, 달리는 동안 TourAPI 기반 관광지와 로컬 장소를 발견하세요.</p>
      <div className="home-data-proof">
        <LiveBadge source={nearby?.source} ms={nearby?.fetchedMs} label={nearby?.cached ? '한국관광공사 TourAPI 캐시' : '한국관광공사 TourAPI'} />
        <span>{area.hub} 위치기반 관광정보 · 기상청 날씨 · 에어코리아 대기질</span>
      </div>
      <div className="home-hero-actions"><Link href={`/courses?area=${area.slug}`}>{area.name} 코스 찾기</Link><Link href={`/programs?area=${area.slug}`}>{area.name} 러닝 일정</Link></div>
    </section>

    <section className="home-region-section"><div className="home-region-head"><div><span>9 DISTRICTS & COUNTIES</span><h2>{area.hub}에서 달리기</h2><p>{area.summary}</p></div><div className="home-region-tools"><Link href="/regions">지역 전체보기</Link><button type="button" onClick={findMyArea} disabled={locationState === 'loading'}>{locationState === 'loading' ? '위치 확인 중' : '내 위치로 찾기'}</button></div></div>{locationMessage && <p className="home-location-message" role="status">{locationMessage}</p>}<div className="home-region-scroll" aria-label="대구 지역 선택">{DAEGU_AREAS.map((option) => <button ref={option.slug === area.slug ? selectedAreaRef : undefined} type="button" className={option.slug === area.slug ? 'on' : ''} aria-pressed={option.slug === area.slug} onClick={() => { setAreaSlug(option.slug); setLocationMessage(''); }} key={option.slug}><b>{option.name}</b><small>{option.hub}</small></button>)}</div><div className="home-region-actions"><Link href={`/spots?area=${area.slug}`}>주변 관광지</Link><Link href={`/mates?area=${area.slug}`}>{area.name} 러너</Link></div></section>

    <section className="quick-run-card" aria-labelledby="quick-run-title">
      <div className="quick-run-head"><div><span>30초 러닝 추천</span><h2 id="quick-run-title">오늘 달릴 방법만 골라보세요.</h2></div><b>{area.name}</b></div>
      <p>{area.hub}을 기준으로 선택한 조건을 다음 화면까지 그대로 이어드려요.</p>
      <div className="quick-run-field"><span>거리</span><div>{[3, 5, 7, 10].map((distance) => <button type="button" className={quickDistance === distance ? 'on' : ''} aria-pressed={quickDistance === distance} onClick={() => setQuickDistance(distance)} key={distance}>{distance}km</button>)}</div></div>
      <div className="quick-run-field"><span>달리기 방식</span><div><button type="button" className={quickMode === 'solo' ? 'on' : ''} aria-pressed={quickMode === 'solo'} onClick={() => setQuickMode('solo')}>혼자 코스 찾기</button><button type="button" className={quickMode === 'together' ? 'on' : ''} aria-pressed={quickMode === 'together'} onClick={() => setQuickMode('together')}>함께 달리기</button></div></div>
      <Link href={quickHref} className="quick-run-submit"><span><b>{quickDistance}km · {quickMode === 'solo' ? quickTheme : `${area.name} 러너`}</b><small>{quickMode === 'solo' ? '내 조건에 맞는 코스 보기' : '거리와 지역이 맞는 메이트 보기'}</small></span><strong>추천 보기 →</strong></Link>
    </section>

    {nextProgram && <section className="home-section home-program-section">
      <div className="home-section-head"><div><span>{area.name} 이번 주 러닝</span><h2>같이 달릴 준비됐나요?</h2></div><Link href={`/programs?area=${area.slug}`}>{area.name} 일정</Link></div>
      <Link href={`/programs?area=${area.slug}`} className="home-next-run">
        <time dateTime={nextProgram.startsAt} className={nextProgram.imageUrl ? 'with-photo' : ''}>{nextProgram.imageUrl && <img src={mediaUrl(nextProgram.imageUrl)} alt=""/>}<strong>{new Date(nextProgram.startsAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</strong><span>{new Date(nextProgram.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span></time>
        <div className="home-next-run-copy"><div><span>{PROGRAM_KIND[nextProgram.kind]} · MVP 시범</span><em>운영 준비 중</em></div><h3>{nextProgram.title}</h3><p>{nextProgram.place} · 실제 신청 전 운영 확정 예정</p></div>
        <span className="home-arrow" aria-hidden>→</span>
      </Link>
    </section>}

    <nav className="home-quick" aria-label="빠른 메뉴">
      <Link href={`/courses?area=${area.slug}`}><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z"/><path d="M9 4v14M15 6v14"/></svg></span><b>코스 찾기</b><small>{area.name} 코스 탐색</small></Link>
      <Link href={runHref}><span className="primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="14" cy="5" r="2"/><path d="m8 21 2-6 3-3 2 3 4 1M5 12l4-4 4 2"/></svg></span><b>{area.runCourseSlug ? '지금 달리기' : '주변 장소'}</b><small>{area.runCourseSlug ? `${area.hub} GPS 시작` : `${area.hub} 먼저 보기`}</small></Link>
      <Link href={`/mates?area=${area.slug}`}><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 5"/></svg></span><b>러닝 메이트</b><small>{area.name} 함께 달리기</small></Link>
    </nav>

    <section className="home-section">
      <div className="home-section-head"><div><span>{area.name} 토박이 추천</span><h2>{area.name}에서 만나는 추천 코스</h2></div><Link href={`/courses?area=${area.slug}`}>{area.name} 코스</Link></div>
      <div className="home-course-grid">{featuredCourses.map((course, index) => <Link href={`/courses/${course.slug}`} className="home-course-card" key={course.id}>
        <div className={`home-course-visual tone-${index + 1}`}>{course.thumbnailUrl && <img src={mediaUrl(course.thumbnailUrl)} alt=""/>}<span>{(course.distanceM / 1000).toFixed(1)}K</span>{localBestCourse?.id === course.id && <em>오늘의 추천</em>}</div>
        <div><small>{course.areaName || '대구광역시'} · {course.difficulty}</small><h3>{course.name}</h3><p>{course.themes.slice(0, 2).join(' · ')}</p></div>
      </Link>)}</div>{featuredCourses.length === 0 && <div className="course-region-empty home-course-empty"><span className="empty-count">공개 코스 0개</span><strong>{area.name}의 첫 러닝 코스를 준비하고 있어요.</strong><p>보행 안전과 실제 경로가 확인된 코스만 공개합니다. 그동안 {area.hub} 주변 장소를 먼저 만나보세요.</p><div><Link href={`/spots?area=${area.slug}`}>주변 장소 보기</Link><Link href="/courses/new">코스 제안하기</Link></div></div>}
    </section>

    {(attraction || featuredPartner) && <section className="home-section">
      <div className="home-section-head"><div><span>코스 밖의 대구</span><h2>달린 뒤, 조금 더 머물기</h2></div>{nearby && <LiveBadge source={nearby.source} ms={nearby.fetchedMs} label={nearby.cached ? 'TourAPI 캐시' : 'TourAPI'} />}</div>
      <div className="home-local-grid">
        {attraction && <Link href={`/spots?area=${area.slug}`} className="home-local-card spot"><div className="home-local-image"><img src={attraction.firstImage || area.image} alt=""/></div><div><small>{area.name} 러닝 가까이 만나는 장소</small><h3>{attraction.title}</h3><p>{attraction.dist != null ? `${area.hub}에서 약 ${(attraction.dist / 1000).toFixed(1)}km` : attraction.addr1}</p><b>{area.name} 장소 더 보기 →</b></div></Link>}
        {featuredPartner && <Link href="/benefits" className="home-local-card benefit"><div className="home-partner-mark">{featuredPartner.imageUrl ? <img src={mediaUrl(featuredPartner.imageUrl)} alt=""/> : <PartnerGlyph/>}</div><div><small>{featuredPartner.category} · {featuredPartner.status === 'COMING_SOON' ? '제휴 준비 중' : '러너 혜택'}</small><h3>{featuredPartner.name}</h3><p>{featuredPartner.offerTitle}</p><b>완주 혜택 더 보기 →</b></div></Link>}
      </div>
    </section>}

    {banners.length > 0 && <section className="home-banner-section"><div className="home-section-head compact"><div><span>LOCAL STRIDE 소식</span><h2>러너를 위한 새로운 소식</h2></div></div><BannerCarousel items={banners}/></section>}
  </main>;
}
