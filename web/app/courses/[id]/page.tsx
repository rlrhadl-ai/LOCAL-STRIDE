'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import type { Course } from '@/lib/types';

const RunMap = dynamic(() => import('@/components/RunMap'), { ssr: false });

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Course | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<Course>(`/courses/${id}`).then(setC).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <main className="page"><AppHeader back title="코스" /><div className="empty">{err}</div></main>;
  if (!c) return <main className="page"><AppHeader back title="코스" /><div className="empty">불러오는 중…</div></main>;
  const cps = c.checkpoints ?? [];
  return (
    <main className="page">
      <AppHeader back title={c.name} />
      <div className="map-wrap" style={{ height: 300, margin: 0, flex: 'none' }}>
        <RunMap route={c.polyline} done={[]} checkpoints={cps} cpState={() => ''} runner={null} pois={(c.pois ?? []).map((p) => p.poi)} />
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="row"><b style={{ fontSize: 18 }}>{(c.distanceM / 1000).toFixed(2)}km</b><span className="tag">{c.difficulty}</span></div>
        <p className="muted" style={{ fontSize: 13, margin: '6px 0 0', lineHeight: 1.5 }}>{c.description}</p>
        <div className="pills" style={{ marginTop: 8 }}>{c.themes.map((t) => <span key={t} className="tag">{t}</span>)}<span className="tag gold">약 {c.estMinutes}분</span><span className="tag">누적 고도 {c.elevationGainM}m</span>{c.source === 'USER' && <span className="tag green">사용자 코스</span>}</div>
      </div>
      <div className="section-title"><h2>체크포인트 {cps.length}곳</h2><span>{cps.length ? `${cps[0].radiusM}m 반경 자동 체크인` : ''}</span></div>
      <div className="stack">{cps.map((cp, i) => <div className="mission" key={cp.id}><span className="n">{i === cps.length - 1 && i > 0 ? 'F' : i === 0 ? 'S' : i}</span><div><h4>{cp.name}</h4><p>{cp.kind} · {(cp.distM / 1000).toFixed(1)}km{cp.dataSource ? ` · ${cp.dataSource}` : ''}</p></div>{cp.reward && <span className="tag gold">리워드</span>}</div>)}</div>
      <div className="section-title"><h2>코스 위 관광지 {(c.pois ?? []).length}곳</h2><span>TourAPI locationBasedList2 형식</span></div>
      <div className="stack">{(c.pois ?? []).map((p) => <div className="list-item" key={p.poiId}><span className="ic">{p.poi.contentTypeId === 39 ? '🍽' : p.poi.contentTypeId === 28 ? '🚣' : '📍'}</span><div><h4>{p.poi.title}</h4><p>{p.poi.addr1 ?? ''} · {(p.distFromStartM / 1000).toFixed(1)}km 지점</p></div><span className="tag">{p.poi.source === 'TOURAPI' ? 'TourAPI' : '저장'}</span></div>)}</div>
      <div style={{ marginTop: 16 }}><Link className="btn" href={`/run/${c.slug}`}>이 코스로 러닝 시작</Link></div>
    </main>
  );
}
