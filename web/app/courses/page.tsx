'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api, mediaUrl } from '@/lib/api';
import type { Course, Recommendation } from '@/lib/types';

const KMS = [3, 5, 7, 10];
const THEMES = ['수변', '야경', '미식', '역사', '골목'];

export default function CoursesPage() {
  const [km, setKm] = useState(5);
  const [theme, setTheme] = useState('수변');
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

  const best = recommendation?.best;
  const bestCourse = best ? items.find((course) => course.id === best.course.id) : null;
  return <main className="page courses-page">
    <AppHeader back title="대구 러닝 코스" right={<Link href="/courses/new" className="btn sm">+ 만들기</Link>}/>
    <section className="course-finder-intro"><span>RUN YOUR DAEGU</span><h1>오늘은 어떤 대구를<br/>달리고 싶나요?</h1><p>거리와 분위기를 고르면 현재 날씨까지 살펴 가장 잘 맞는 코스를 찾아드려요.</p></section>

    <section className="course-controls" aria-label="추천 조건">
      <div><span>거리</span><div>{KMS.map((value) => <button type="button" className={km === value ? 'on' : ''} onClick={() => setKm(value)} key={value}>{value}km</button>)}</div></div>
      <div><span>분위기</span><div>{THEMES.map((value) => <button type="button" className={theme === value ? 'on' : ''} onClick={() => setTheme(value)} key={value}>{value}</button>)}</div></div>
    </section>

    {best && bestCourse && <Link href={`/courses/${bestCourse.slug}`} className={`course-pick ${loading ? 'loading' : ''}`}>
      <div className="course-pick-visual">{bestCourse.thumbnailUrl && <img src={mediaUrl(bestCourse.thumbnailUrl)} alt=""/>}<span>조건 맞춤 PICK</span><b>{(bestCourse.distanceM / 1000).toFixed(1)}K</b></div>
      <div className="course-pick-copy"><small>오늘의 추천 · 점수 {best.score}</small><h2>{bestCourse.name}</h2><p>{best.reasons[0] || `${km}km와 ${theme} 분위기에 가장 잘 맞는 코스예요.`}</p><div><span>{bestCourse.difficulty}</span>{bestCourse.themes.slice(0, 2).map((item) => <span key={item}>{item}</span>)}</div><strong>코스 자세히 보기 →</strong></div>
    </Link>}

    <div className="course-catalog-head"><div><span>DAEGU ROUTE</span><h2>{theme} 코스</h2></div><small>{loading ? '불러오는 중' : `${items.length}개`}</small></div>
    <div className="course-catalog">{items.map((course, index) => <Link className="catalog-course" href={`/courses/${course.slug}`} key={course.id}>
      <div className={`catalog-thumb tone-${(index % 4) + 1}`}>{course.thumbnailUrl && <img src={mediaUrl(course.thumbnailUrl)} alt=""/>}<span>{(course.distanceM / 1000).toFixed(1)}K</span></div>
      <div><small>{course.areaName || '대구광역시'} · {course.difficulty}</small><h3>{course.name}</h3><p>{course.description || '대구의 풍경과 이야기를 가까이에서 만나는 러닝 코스'}</p><div>{course.themes.slice(0, 3).map((item) => <span key={item}>{item}</span>)}</div></div><b aria-hidden>→</b>
    </Link>)}</div>
    {!loading && items.length === 0 && <div className="empty">해당 분위기의 코스를 준비하고 있어요.</div>}
  </main>;
}
