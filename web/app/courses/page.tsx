'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api, mediaUrl } from '@/lib/api';
import { DAEGU_AREAS, daeguAreaFromText } from '@/lib/daegu-areas';
import type { Course, Recommendation } from '@/lib/types';

const KMS = [3, 5, 7, 10];
const THEMES = ['수변', '야경', '미식', '역사', '골목'];

export default function CoursesPage() {
  const [km, setKm] = useState(5);
  const [theme, setTheme] = useState('수변');
  const [area, setArea] = useState('전체');
  const [items, setItems] = useState<Course[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true; setLoading(true);
    Promise.all([
      api.get<{ items: Course[] }>(`/courses?theme=${encodeURIComponent(theme)}`),
      api.get<Recommendation>(`/recommend?km=${km}&themes=${encodeURIComponent(theme)}`),
    ]).then(([courses, recommended]) => { if (alive) { setItems(courses.items); setRecommendation(recommended); } })
      .catch(() => { if (alive) { setItems([]); setRecommendation(null); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [km, theme]);

  const courseArea = (course: Course) => course.slug.includes('modern-alley') ? '중구' : daeguAreaFromText(`${course.areaName} ${course.name} ${course.description}`)?.name || '대구 전체';
  const visibleItems = area === '전체' ? items : items.filter((course) => courseArea(course) === area);
  const best = recommendation?.best;
  const bestCourse = best ? items.find((course) => course.id === best.course.id) : null;
  const visibleBestCourse = bestCourse && (area === '전체' || courseArea(bestCourse) === area) ? bestCourse : visibleItems[0] || null;
  return <main className="page courses-page">
    <AppHeader back title="대구 러닝 코스" right={<Link href="/courses/new" className="btn sm">+ 만들기</Link>}/>
    <section className="course-finder-intro"><span>RUN YOUR DAEGU</span><h1>오늘은 어떤 대구를<br/>달리고 싶나요?</h1><p>거리와 분위기를 고르면 현재 날씨까지 살펴 가장 잘 맞는 코스를 찾아드려요.</p></section>

    <section className="course-controls" aria-label="추천 조건">
      <div><span>지역</span><div className="course-area-options"><button type="button" className={area === '전체' ? 'on' : ''} onClick={() => setArea('전체')}>대구 전체</button>{DAEGU_AREAS.map((value) => <button type="button" className={area === value.name ? 'on' : ''} onClick={() => setArea(value.name)} key={value.slug}>{value.name}</button>)}</div></div>
      <div><span>거리</span><div>{KMS.map((value) => <button type="button" className={km === value ? 'on' : ''} onClick={() => setKm(value)} key={value}>{value}km</button>)}</div></div>
      <div><span>분위기</span><div>{THEMES.map((value) => <button type="button" className={theme === value ? 'on' : ''} onClick={() => setTheme(value)} key={value}>{value}</button>)}</div></div>
    </section>

    {visibleBestCourse && <Link href={`/courses/${visibleBestCourse.slug}`} className={`course-pick ${loading ? 'loading' : ''}`}>
      <div className="course-pick-visual">{visibleBestCourse.thumbnailUrl && <img src={mediaUrl(visibleBestCourse.thumbnailUrl)} alt=""/>}<span>{area === '전체' ? '조건 맞춤 PICK' : `${area} 검증 코스`}</span><b>{(visibleBestCourse.distanceM / 1000).toFixed(1)}K</b></div>
      <div className="course-pick-copy"><small>{area === '전체' && best ? `오늘의 추천 · 점수 ${best.score}` : `${area} 공개 코스`}</small><h2>{visibleBestCourse.name}</h2><p>{area === '전체' ? best?.reasons[0] || `${km}km와 ${theme} 분위기에 가장 잘 맞는 코스예요.` : '실제 경로와 체크포인트가 등록된 코스입니다.'}</p><div><span>{visibleBestCourse.difficulty}</span>{visibleBestCourse.themes.slice(0, 2).map((item) => <span key={item}>{item}</span>)}</div><strong>코스 자세히 보기 →</strong></div>
    </Link>}

    <div className="course-catalog-head"><div><span>DAEGU ROUTE</span><h2>{area === '전체' ? theme : `${area} · ${theme}`} 코스</h2></div><small>{loading ? '불러오는 중' : `${visibleItems.length}개`}</small></div>
    <div className="course-catalog">{visibleItems.map((course, index) => <Link className="catalog-course" href={`/courses/${course.slug}`} key={course.id}>
      <div className={`catalog-thumb tone-${(index % 4) + 1}`}>{course.thumbnailUrl && <img src={mediaUrl(course.thumbnailUrl)} alt=""/>}<span>{(course.distanceM / 1000).toFixed(1)}K</span></div>
      <div><small>{course.areaName || '대구광역시'} · {course.difficulty}</small><h3>{course.name}</h3><p>{course.description || '대구의 풍경과 이야기를 가까이에서 만나는 러닝 코스'}</p><div>{course.themes.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div></div><b aria-hidden>→</b>
    </Link>)}</div>
    {!loading && visibleItems.length === 0 && <div className="course-region-empty"><strong>{area === '전체' ? '대구 전체' : area} · {theme} 코스는 검증 준비 중이에요.</strong><p>보행 안전·통행·공사 정보를 확인한 코스만 공개합니다. 먼저 주변 관광지를 탐색하거나 코스를 제안해 보세요.</p><div><Link href={`/spots?area=${DAEGU_AREAS.find((item) => item.name === area)?.slug || 'suseong'}`}>주변 장소 보기</Link><Link href="/courses/new">코스 제안하기</Link></div></div>}
  </main>;
}
