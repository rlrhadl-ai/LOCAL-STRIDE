'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import BannerCarousel from '@/components/BannerCarousel';
import { api, mediaUrl } from '@/lib/api';
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

  useEffect(() => {
    let alive = true;
    api.get<{ items: Course[] }>('/courses').then((result) => alive && setCourses(result.items)).catch(() => undefined);
    api.get<Recommendation>('/recommend?km=5&themes=%EC%88%98%EB%B3%80%2C%EC%95%BC%EA%B2%BD').then((result) => alive && setRec(result)).catch(() => undefined);
    api.get<{ items: RunProgram[] }>('/programs?limit=3').then((result) => alive && setPrograms(result.items)).catch(() => undefined);
    api.get<{ items: PartnerOffer[] }>('/partners').then((result) => alive && setPartners(result.items)).catch(() => undefined);
    api.get<{ items: HomeBanner[] }>('/banners').then((result) => alive && setBanners(result.items)).catch(() => undefined);
    api.get<NearbyResult>('/tour/nearby?lat=35.8277&lng=128.6177&radius=5000&limit=12').then((result) => alive && setNearby(result)).catch(() => undefined);
    return () => { alive = false; };
  }, []);

  const nextProgram = programs[0];
  const best = rec?.best?.course;
  const bestCourse = best ? courses.find((course) => course.id === best.id) : null;
  const featuredCourses = (bestCourse ? [bestCourse, ...courses.filter((course) => course.id !== bestCourse.id)] : courses).slice(0, 2);
  const attraction = (nearby?.items ?? []).find((item) => [12, 14, 28].includes(item.contentTypeId));
  const featuredPartner = partners.find((partner) => partner.name.includes('러너스테이')) ?? partners[0];
  const weather = rec?.weather;

  return <main className="page home-page">
    <AppHeader right={<Link href="/me" className="icon-btn" aria-label="마이"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></Link>} />

    <section className="home-hero">
      <div className="home-hero-meta"><span>DAEGU BORN · RUN TOGETHER</span><b>{weather ? `${weather.temp}° · ${weather.sky}` : '대구 러너 에디션'}</b></div>
      <h1>대구의 길을<br/><em>대구 사람과 달려요.</em></h1>
      <p>토박이 러너가 고른 코스와 오늘 함께 뛸 사람을 한곳에서 만나보세요.</p>
      <div className="home-hero-actions"><Link href="/programs">이번 주 러닝 참여</Link><Link href="/courses">대구 코스 보기</Link></div>
    </section>

    <section className="home-section home-program-section">
      <div className="home-section-head"><div><span>이번 주 러닝</span><h2>같이 달릴 준비됐나요?</h2></div><Link href="/programs">전체 일정</Link></div>
      {nextProgram ? <Link href="/programs" className="home-next-run">
        <time dateTime={nextProgram.startsAt}><strong>{new Date(nextProgram.startsAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</strong><span>{new Date(nextProgram.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span></time>
        <div className="home-next-run-copy"><div><span>{PROGRAM_KIND[nextProgram.kind]}</span><em>남은 자리 {nextProgram.remaining}</em></div><h3>{nextProgram.title}</h3><p>{nextProgram.place} · {nextProgram.host?.nickname || '대구 로컬 호스트'}</p></div>
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
      <div className="home-section-head"><div><span>코스 밖의 대구</span><h2>달린 뒤, 조금 더 머물기</h2></div></div>
      <div className="home-local-grid">
        {attraction && <Link href="/spots" className="home-local-card spot"><div className="home-local-image">{attraction.firstImage ? <img src={attraction.firstImage} alt=""/> : <span>DAEGU<br/>LOCAL</span>}</div><div><small>러닝 가까이 만나는 장소</small><h3>{attraction.title}</h3><p>{attraction.dist != null ? `수성못에서 약 ${(attraction.dist / 1000).toFixed(1)}km` : attraction.addr1}</p><b>대구 장소 더 보기 →</b></div></Link>}
        {featuredPartner && <Link href="/benefits" className="home-local-card benefit"><div className="home-partner-mark">{featuredPartner.imageUrl ? <img src={mediaUrl(featuredPartner.imageUrl)} alt=""/> : <PartnerGlyph/>}</div><div><small>{featuredPartner.category} · {featuredPartner.status === 'COMING_SOON' ? '제휴 준비 중' : '러너 혜택'}</small><h3>{featuredPartner.name}</h3><p>{featuredPartner.offerTitle}</p><b>완주 혜택 더 보기 →</b></div></Link>}
      </div>
    </section>}

    {banners.length > 0 && <section className="home-banner-section"><div className="home-section-head compact"><div><span>LOCAL STRIDE 소식</span><h2>러너를 위한 새로운 소식</h2></div></div><BannerCarousel items={banners}/></section>}
  </main>;
}
