'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { cumulative } from '@/lib/geo';
import type { Course, LatLng } from '@/lib/types';

const BuilderMap = dynamic(() => import('@/components/BuilderMap'), { ssr: false });
const THEMES = ['수변', '야경', '미식', '역사', '골목', '자연'];

export default function NewCourse() {
  const router = useRouter();
  const [points, setPoints] = useState<LatLng[]>([]);
  const [name, setName] = useState('');
  const [themes, setThemes] = useState<string[]>(['수변']);
  const [difficulty, setDifficulty] = useState('초중급');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const cum = cumulative(points); const total = cum[cum.length - 1] ?? 0;

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      const c = await api.post<Course & { enrichment: { source: string; poiCount: number } }>('/courses', { name, themes, difficulty, points });
      router.push(`/courses/${c.slug}`);
    } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <main className="page">
      <AppHeader back title="코스 만들기" />
      <p className="muted" style={{ fontSize: 13, margin: '0 0 10px' }}>지도를 눌러 경유지를 찍으세요. 거리·체크포인트가 자동 계산되고, 경로 주변 관광지는 TourAPI로 자동으로 붙습니다.</p>
      <div className="builder-map"><BuilderMap points={points} center={[35.8277, 128.6177]} onAdd={(p) => setPoints((s) => [...s, p])} /></div>
      <div className="row" style={{ margin: '10px 0' }}>
        <b style={{ fontSize: 18 }}>{(total / 1000).toFixed(2)}km <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>· 경유지 {points.length}</span></b>
        <div style={{ display: 'flex', gap: 6 }}><button className="btn sm light" type="button" onClick={() => setPoints((s) => s.slice(0, -1))}>되돌리기</button><button className="btn sm light" type="button" onClick={() => setPoints([])}>초기화</button></div>
      </div>
      <div className="card stack">
        <label className="field">코스 이름<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 우리 동네 저녁 5K" maxLength={40} /></label>
        <div className="field"><span>테마</span><div className="pills">{THEMES.map((t) => <button key={t} type="button" className={`pill ${themes.includes(t) ? 'on' : ''}`} onClick={() => setThemes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</button>)}</div></div>
        <div className="field"><span>난이도</span><div className="pills">{['초급', '초중급', '중급', '상급'].map((d) => <button key={d} type="button" className={`pill ${difficulty === d ? 'on' : ''}`} onClick={() => setDifficulty(d)}>{d}</button>)}</div></div>
        {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        <button className="btn" type="button" disabled={busy || name.length < 2 || points.length < 2 || total < 300 || themes.length === 0} onClick={submit}>{busy ? '관광지 붙이는 중…' : '코스 저장'}</button>
      </div>
    </main>
  );
}
