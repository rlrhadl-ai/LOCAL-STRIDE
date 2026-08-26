'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import LiveBadge from '@/components/LiveBadge';
import { api } from '@/lib/api';
import type { Course, Recommendation } from '@/lib/types';

const KMS = [3, 5, 7, 10];
const THEMES = ['수변', '야경', '미식', '역사'];

export default function Home() {
  const router = useRouter();
  const [km, setKm] = useState(5);
  const [themes, setThemes] = useState<string[]>(['수변', '야경']);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.get<Recommendation>(`/recommend?km=${km}&themes=${encodeURIComponent(themes.join(','))}`), api.get<{ items: Course[] }>('/courses')])
      .then(([r, c]) => { if (!alive) return; setRec(r); setCourses(c.items); setErr(''); })
      .catch((e) => alive && setErr(`API에 연결할 수 없어요 — ${e.message}. api 폴더에서 npm run dev 가 켜져 있는지 확인`))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [km, themes]);

  const wx = rec?.weather;
  const best = rec?.best;
  return (
    <main className="page">
      <AppHeader right={<Link href="/me" className="icon-btn" aria-label="마이"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></Link>} />
      <p className="greet">안녕하세요, 러너님! 👋 오늘도 멋진 러닝 되세요!</p>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: 13 }}>{err}</div>}
      <div className="card weather">
        <div>
          <div className="loc">대구광역시 수성구 · 수성못</div>
          <div className="temp">{wx ? `${wx.temp}°C` : '--'}<small>{wx?.sky ?? ''}</small></div>
          <div className="meta">습도 {wx?.humidity ?? '-'}% · 풍속 {wx?.windMs ?? '-'}m/s · 미세먼지 <b>{wx?.pm10Grade ?? '-'}</b> · 일몰 {wx?.sunset ?? '-'}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}><LiveBadge source={wx?.source} label={wx?.source === 'KMA' ? '기상청' : '기상 시연값'} /><LiveBadge source={wx?.airSource} label={wx?.airSource === 'AIRKOREA' ? '에어코리아' : '대기 시연값'} /></div>
        </div>
        <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>
      </div>

      <div className="section-title"><h2>오늘의 러닝 조건</h2><span>선택하면 추천이 바뀝니다</span></div>
      <div className="card cond">
        <div className="cond-row"><span className="lbl">거리</span>{KMS.map((k) => <button key={k} type="button" className={`pill ${km === k ? 'on' : ''}`} onClick={() => setKm(k)}>{k}km</button>)}</div>
        <div className="cond-row"><span className="lbl">테마</span>{THEMES.map((t) => <button key={t} type="button" className={`pill ${themes.includes(t) ? 'on' : ''}`} onClick={() => setThemes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</button>)}</div>
      </div>

      <div className="section-title"><h2>AI 맞춤 코스 추천</h2><span>추천 이유까지 함께</span></div>
      <div className="ai-card" style={{ opacity: loading ? .7 : 1 }}>
        <span className="ai-badge">✦ AI 추천</span>
        <h3>{best?.course.name ?? '추천 계산 중…'}</h3>
        <div className="sub">{best ? `${(best.course.distanceM / 1000).toFixed(1)}km · ${best.course.difficulty} · 약 ${best.course.estMinutes}분 · 점수 ${best.score}` : ''}</div>
        <div className="tags">{best?.course.themes.map((t) => <span key={t} className="tag ghost">{t}</span>)}{best?.course.source === 'USER' && <span className="tag ghost">사용자 코스</span>}</div>
        <div className="reasons-head">추천 이유</div>
        <ul className="reasons">{best?.reasons.map((r, i) => <li key={i}><span /><span>{r}</span></li>)}</ul>
        <button className="btn" type="button" disabled={!best} onClick={() => best && router.push(`/run/${best.course.slug}`)}>이 코스로 러닝 시작</button>
      </div>

      <div className="section-title"><h2>코스</h2><Link href="/courses/new">+ 직접 만들기</Link></div>
      <div className="course-list">
        {courses.map((c, i) => (
          <div className="course" key={c.id}>
            <div className={`thumb ${c.source === 'USER' ? 'user' : `t${i % 4}`}`} />
            <div><h4>{c.name}</h4><p>{(c.distanceM / 1000).toFixed(1)}km · {c.difficulty} · {c.themes.join('/')}{best?.course.id === c.id ? ' · ' : ''}{best?.course.id === c.id && <b style={{ color: 'var(--blue)' }}>AI 추천</b>}</p></div>
            <Link className="go" href={`/courses/${c.slug}`}>보기</Link>
          </div>
        ))}
      </div>
      <p className="note">코스·관광지 데이터는 한국관광공사 TourAPI 4.0 형식으로 저장·갱신됩니다. LIVE 배지가 붙은 값은 지금 API에서 받아온 실데이터입니다.</p>
    </main>
  );
}
