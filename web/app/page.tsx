'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import BannerCarousel from '@/components/BannerCarousel';
import LiveBadge from '@/components/LiveBadge';
import { api, mediaUrl } from '@/lib/api';
import { DAEGU_AREAS, DEFAULT_DAEGU_AREA, daeguAreaByName } from '@/lib/daegu-areas';
import type { Course, HomeBanner, NearbyResult, PartnerOffer, Recommendation, RunProgram } from '@/lib/types';

const PROGRAM_KIND: Record<RunProgram['kind'], string> = {
  MORNING: '아침런', AFTER_WORK: '퇴근런', INDEPENDENT: '독립런', THEME: '주제형 러닝', POPUP: '번개런',
};

function PartnerGlyph() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden><path d="M11 32c5-2 7-6 8-13 4 6 8 9 18 10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><path d="M12 35h25" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><circle cx="31" cy="16" r="4" fill="currentColor"/></svg>;
}
export default function Home() {
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [partners, setPartners] = useState<PartnerOffer[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [programs, setPrograms] = useState<RunProgram[]>([]);
  const [areaSlug, setAreaSlug] = useState(DEFAULT_DAEGU_AREA.slug);
  const area = daeguAreaByName(areaSlug);

  useEffect(() => {
    let alive = true;
    api.get<{ items: Course[] }>('/courses').then((result) => alive && setCourses(result.items)).catch(() => undefined);
    api.get<{ items: RunProgram[] }>('/programs?limit=3').then((result) => alive && setPrograms(result.items)).catch(() => undefined);
    api.get<{ items: PartnerOffer[] }>('/partners').then((result) => alive && setPartners(result.items)).catch(() => undefined);
    api.get<{ items: HomeBanner[] }>('/banners').then((result) => alive && setBanners(result.items)).catch(() => undefined);
    try { const saved = localStorage.getItem('localstride_daegu_area'); if (saved) setAreaSlug(daeguAreaByName(saved).slug); } catch { /* use default */ }
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true; const selected = daeguAreaByName(areaSlug);
    try { localStorage.setItem('localstride_daegu_area', selected.slug); } catch { /* storage is optional */ }
    api.get<Recommendation>(`/recommend?km=5&themes=${encodeURIComponent(selected.themes.slice(0, 2).join(','))}&lat=${selected.lat}&lng=${selected.lng}`).then((result) => alive && setRec(result)).catch(() => undefined);
    api.get<NearbyResult>(`/tour/nearby?lat=${selected.lat}&lng=${selected.lng}&radius=5000&limit=12`).then((result) => alive && setNearby(result)).catch(() => undefined);
    return () => { alive = false; };
  }, [areaSlug]);

  const nextProgram = programs[0];
  const best = rec?.best?.course;
  const bestCourse = best ? courses.find((course) => course.id === best.id) : null;
  const localCourses = courses.filter((course) => `${course.areaName} ${course.name} ${course.description}`.includes(area.name) || `${course.name} ${course.description}`.includes(area.hub));
  const coursePool = localCourses.length ? [...localCourses, ...courses.filter((course) => !localCourses.some((local) => local.id === course.id))] : courses;
  const featuredCourses = (bestCourse ? [bestCourse, ...coursePool.filter((course) => course.id !== bestCourse.id)] : coursePool).slice(0, 2);
  const attraction = (nearby?.items ?? []).find((item) => [12, 14, 28].includes(item.contentTypeId));
  const featuredPartner = partners.find((partner) => partner.name === '러너스데이') ?? partners.find((partner) => partner.name.includes('러너스테이')) ?? partners[0];
  const weather = rec?.weather;

  return <main className="page home-page">
    <AppHeader right={<Link href="/me" className="icon-btn" aria-label="마이"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></Link>} />

    <section className="home-hero">
      <div className="home-hero-meta"><span>DAEGU BORN · RUN TOGETHER</span><b>{weather ? `${weather.temp}° · ${weather.sky}` : '대구 러너 에디션'} · {area.name}</b></div>
      <h1>대구의 길을<br/><em>대구 사람과 달려요.</em></h1>
      <p>여행 중 현재 위치에서 코스를 추천받고, 달리는 동안 TourAPI 기반 관광지와 로컬 장소를 자동으로 발견하세요.</p>
      <div className="home-data-proof">
        <LiveBadge source={nearby?.source} ms={nearby?.fetchedMs} label={nearby?.cached ? '한국관광공사 TourAPI 캐시' : '한국관광공사 TourAPI'} />
        <span>{area.hub} 위치기반 관광정보 · 기상청 날씨 · 에어코리아 대기질</span>
      </div>
      <div className="home-hero-actions"><Link href="/programs">이번 주 러닝 참여</Link><Link href="/courses">대구 코스 보기</Link></div>
    </section>

    <section className="home-region-section"><div className="home-region-head"><div><span>9 DISTRICTS & COUNTIES</span><h2>{area.hub}에서 달리기</h2><p>{area.summary}</p></div><Link href="/regions">지역 전체보기</Link></div><div className="home-region-scroll">{DAEGU_AREAS.map((option) => <button type="button" className={option.slug === area.slug ? 'on' : ''} onClick={() => setAreaSlug(option.slug)} key={option.slug}><b>{option.name}</b><small>{option.hub}</small></button>)}</div><div className="home-region-actions"><Link href={`/spots?area=${area.slug}`}>주변 관광지</Link><Link href={`/mates?area=${area.slug}`}>{area.name} 러너</Link></div></section>

    <section className="home-section home-program-section">
      <div className="home-section-head"><div><span>이번 주 러닝</span><h2>같이 달릴 준비됐나요?</h2></div><Link href="/programs">전체 일정</Link></div>
      {nextProgram ? <Link href="/programs" className="home-next-run">
        <time dateTime={nextProgram.startsAt} className={nextProgram.imageUrl ? 'with-photo' : ''}>{nextProgram.imageUrl && <img src={mediaUrl(nextProgram.imageUrl)} alt=""/>}<strong>{new Date(nextProgram.startsAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</strong><span>{new Date(nextProgram.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span></time>
        <div className="home-next-run-copy"><div><span>{PROGRAM_KIND[nextProgram.kind]} · MVP 시범</span><em>운영 준비 중</em></div><h3>{nextProgram.title}</h3><p>{nextProgram.place} · 실제 신청 전 운영 확정 예정</p></div>
        <span className="home-arrow" aria-hidden>→</span>
      </Link> : <div className="home-empty">다음 로컬 러닝을 준비하고 있어요.</div>}
    </section>

    <nav className="home-quick" aria-label="빠른 메뉴">
      <Link href="/courses"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z"/><path d="M9 4v14M15 6v14"/></svg></span><b>코스 찾기</b><small>대구 코스 탐색</small></Link>
      <Link href="/run/suseong-blue-5k"><span className="primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="14" cy="5" r="2"/><path d="m8 21 2-6 3-3 2 3 4 1M5 12l4-4 4 2"/></svg></span><b>지금 달리기</b><small>GPS 러닝 시작</small></Link>
      <Link href="/mates"><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 7 5"/></svg></span><b>러닝 메이트</b><small>함께 뛸 사람</small></Link>
    </nav>

    <section className="home-section">
      <div className="home-section-head"><div><span>토박이 추천</span><h2>대구를 가장 잘 느끼는 코스</h2></div><Link href="/courses">전체 코스</Link></div>
      <div className="home-course-grid">{featuredCourses.map((course, index) => <Link href={`/courses/${course.slug}`} className="home-course-card" key={course.id}>
        <div className={`home-course-visual tone-${index + 1}`}>{course.thumbnailUrl && <img src={mediaUrl(course.thumbnailUrl)} alt=""/>}<span>{(course.distanceM / 1000).toFixed(1)}K</span>{best?.id === course.id && <em>오늘의 추천</em>}</div>
        <div><small>{course.areaName || '대구광역시'} · {course.difficulty}</small><h3>{course.name}</h3><p>{course.themes.slice(0, 2).join(' · ')}</p></div>
      </Link>)}</div>
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
