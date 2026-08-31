'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { DAEGU_AREAS, daeguAreaFromCourse, daeguAreaFromText } from '@/lib/daegu-areas';
import type { Course, RunProgram } from '@/lib/types';

interface CrewSummary { id: string; area: string; name: string }
interface MateSummary { id: string; place: string; body: string; meetAt: string }
interface EventSummary { id: string; place: string | null; title: string; description: string }

export default function RegionsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [crews, setCrews] = useState<CrewSummary[]>([]);
  const [mates, setMates] = useState<MateSummary[]>([]);
  const [programs, setPrograms] = useState<RunProgram[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ items: Course[] }>('/courses').then((result) => result.items).catch(() => []),
      api.get<{ items: CrewSummary[] }>('/crews').then((result) => result.items).catch(() => []),
      api.get<{ items: MateSummary[] }>('/mates').then((result) => result.items).catch(() => []),
      api.get<{ items: RunProgram[] }>('/programs').then((result) => result.items).catch(() => []),
      api.get<{ items: EventSummary[] }>('/events').then((result) => result.items).catch(() => []),
    ]).then(([courseItems, crewItems, mateItems, programItems, eventItems]) => { setCourses(courseItems); setCrews(crewItems); setMates(mateItems); setPrograms(programItems); setEvents(eventItems); }).finally(() => setLoading(false));
  }, []);

  const coverage = useMemo(() => DAEGU_AREAS.map((area) => {
    const matches = (value: string) => daeguAreaFromText(value)?.name === area.name;
    const courseCount = courses.filter((course) => daeguAreaFromCourse(course)?.name === area.name).length;
    const communityCount = crews.filter((crew) => matches(`${crew.area} ${crew.name}`)).length + mates.filter((mate) => new Date(mate.meetAt).getTime() > Date.now() && matches(`${mate.place} ${mate.body}`)).length;
    const scheduleCount = programs.filter((program) => matches(`${program.place || ''} ${program.title} ${program.description}`)).length + events.filter((event) => matches(`${event.place || ''} ${event.title} ${event.description}`)).length;
    const status = courseCount > 0 ? '공개 코스 있음' : communityCount + scheduleCount > 0 ? '커뮤니티 준비' : '장소 탐색 가능';
    return { area, courseCount, communityCount, scheduleCount, active: courseCount + communityCount + scheduleCount > 0, status };
  }), [courses, crews, events, mates, programs]);
  const activeCount = coverage.filter((item) => item.active).length;

  return <main className="page region-page">
    <AppHeader back title="대구 지역 탐색" />
    <section className="region-hero"><span>ALL AROUND DAEGU</span><h1>수성못에서 시작해<br />대구 전체로.</h1><p>9개 구·군의 러닝 거점을 선택하면 주변 관광지·커뮤니티·일정을 한번에 탐색할 수 있어요.</p><div><span><b>9</b>개 구·군</span><span><b>{loading ? '-' : activeCount}</b>콘텐츠 등록 지역</span><span><b>5km</b>TourAPI 탐색 반경</span></div></section>
    <div className="region-proof"><strong>한국관광공사 TourAPI</strong><span>각 지역 러닝 거점 반경의 관광지·문화시설·레포츠 정보를 같은 방식으로 조회합니다.</span></div>
    <div className="section-title region-title"><div><span>9 DISTRICTS & COUNTIES</span><h2>어느 대구를 달릴까요?</h2></div><small>{loading ? '데이터 확인 중' : '실제 등록 현황 기준'}</small></div>
    <section className="region-grid">{coverage.map(({ area, courseCount, communityCount, scheduleCount, active, status }, index) => <article className={`region-card ${active ? 'active' : 'planned'}`} key={area.slug}>
      <div className="region-card-image"><img src={area.image} alt="" /><span>0{index + 1}</span><em>{status}</em></div>
      <div className="region-card-copy"><small>{area.fullName} · {area.hub}</small><h2>{area.name}</h2><p>{area.summary}</p><div className="region-theme-row">{area.themes.map((theme) => <span key={theme}>{theme}</span>)}</div><dl><div><dt>공개 코스</dt><dd>{courseCount}</dd></div><div><dt>크루·메이트</dt><dd>{communityCount}</dd></div><div><dt>프로그램·대회</dt><dd>{scheduleCount}</dd></div></dl><div className="region-actions"><Link href={`/spots?area=${area.slug}`}>주변 장소</Link><Link href={`/courses?area=${area.slug}`}>코스 확인</Link><Link href={`/mates?area=${area.slug}`}>러너 찾기</Link><Link href={`/programs?area=${area.slug}`}>일정 보기</Link></div></div>
    </article>)}</section>
    <p className="region-disclaimer">모든 지역에서 TourAPI 주변 장소를 탐색할 수 있습니다. 러닝 코스는 보행 안전·통행·공사 정보를 확인한 뒤 공개하며, 커뮤니티와 일정은 등록 현황에 따라 표시합니다.</p>
  </main>;
}
