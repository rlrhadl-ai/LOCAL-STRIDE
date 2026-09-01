'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDaeguArea } from './DaeguAreaProvider';

const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  courses: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></svg>,
  run: <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="15" cy="4" r="2" /><path d="M13.5 8l-2.7 1.2L9 12.5l2 1-1.4 3.3L6 20l1.7 1.2 4.3-3.6 1.4-2.6 2.4 2.4V22h2v-5.6l-3-3 1-2.6 2.4 1.6L20 8.4l-2.6-2z" /></svg>,
  crews: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 20a5 5 0 0 1 5.5-5" /></svg>,
  me: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
};

export default function TabBar() {
  const p = usePathname() || '/';
  const { area } = useDaeguArea();
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  useEffect(() => {
    if (!runMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setRunMenuOpen(false);
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [runMenuOpen]);
  useEffect(() => setRunMenuOpen(false), [p]);
  if (p.startsWith('/run/') || p.startsWith('/finish/') || p.startsWith('/admin') || p === '/login' || p === '/signup') return null;
  const on = (h: string) => (h === '/' ? p === '/' : p.startsWith(h));
  return (
    <>
      <nav className="tabbar" aria-label="하단 메뉴">
        <Link href="/" className={`tab ${on('/') ? 'on' : ''}`}>{I.home}홈</Link>
        <Link href={`/courses?area=${area.slug}`} className={`tab ${on('/courses') ? 'on' : ''}`}>{I.courses}코스</Link>
        <button type="button" className="tab cta" aria-haspopup="dialog" aria-expanded={runMenuOpen} aria-controls="run-action-sheet" onClick={() => setRunMenuOpen(true)}><span className="orb">{I.run}</span><span>러닝</span></button>
        <Link href={`/crews?area=${area.slug}`} className={`tab ${on('/crews') || on('/mates') || on('/events') ? 'on' : ''}`}>{I.crews}함께</Link>
        <Link href="/me" className={`tab ${on('/me') || on('/missions') || on('/rankings') ? 'on' : ''}`}>{I.me}마이</Link>
      </nav>
      {runMenuOpen && <>
        <button type="button" className="run-sheet-backdrop" aria-label="러닝 메뉴 닫기" onClick={() => setRunMenuOpen(false)} />
        <section id="run-action-sheet" className="run-action-sheet" role="dialog" aria-modal="true" aria-labelledby="run-sheet-title">
          <div className="run-sheet-handle" aria-hidden />
          <div className="run-sheet-heading"><div><span>QUICK START · {area.name}</span><h2 id="run-sheet-title">어떻게 달릴까요?</h2><p>지금 필요한 행동을 선택하면 바로 이어드려요.</p></div><button type="button" aria-label="닫기" onClick={() => setRunMenuOpen(false)}>×</button></div>
          <div className="run-sheet-actions">
            {area.runCourseSlug && <Link href={`/run/${area.runCourseSlug}`} className="primary" onClick={() => setRunMenuOpen(false)}><strong>{area.hub} 추천 코스로 바로 시작</strong><small>GPS를 켜고 러닝 화면 열기</small><span>→</span></Link>}
            <Link href={`/courses?area=${area.slug}`} onClick={() => setRunMenuOpen(false)}><strong>{area.name} 코스 고르기</strong><small>거리와 분위기로 비교하기</small><span>→</span></Link>
            <Link href={`/mates?area=${area.slug}`} onClick={() => setRunMenuOpen(false)}><strong>함께 달릴 러너 찾기</strong><small>페이스와 시간대가 맞는 메이트 보기</small><span>→</span></Link>
            <Link href={`/spots?area=${area.slug}`} onClick={() => setRunMenuOpen(false)}><strong>주변 장소 먼저 보기</strong><small>TourAPI 기반 관광지와 로컬 장소</small><span>→</span></Link>
          </div>
        </section>
      </>}
    </>
  );
}
