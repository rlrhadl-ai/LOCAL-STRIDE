'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  if (p.startsWith('/run/') || p.startsWith('/finish/') || p.startsWith('/admin') || p === '/login' || p === '/signup') return null;
  const on = (h: string) => (h === '/' ? p === '/' : p.startsWith(h));
  const runHref = area.runCourseSlug ? `/run/${area.runCourseSlug}` : `/courses?area=${area.slug}`;
  return (
    <nav className="tabbar" aria-label="하단 메뉴">
      <Link href="/" className={`tab ${on('/') ? 'on' : ''}`}>{I.home}홈</Link>
      <Link href={`/courses?area=${area.slug}`} className={`tab ${on('/courses') ? 'on' : ''}`}>{I.courses}코스</Link>
      <Link href={runHref} className="tab cta" aria-label={area.runCourseSlug ? `${area.name} 러닝 시작` : `${area.name} 러닝 코스 선택`}><span className="orb">{I.run}</span><span>러닝</span></Link>
      <Link href={`/crews?area=${area.slug}`} className={`tab ${on('/crews') || on('/mates') || on('/events') ? 'on' : ''}`}>{I.crews}함께</Link>
      <Link href="/me" className={`tab ${on('/me') || on('/missions') || on('/rankings') ? 'on' : ''}`}>{I.me}마이</Link>
    </nav>
  );
}
