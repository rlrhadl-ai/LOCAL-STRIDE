'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import LiveBadge from '@/components/LiveBadge';
import { api } from '@/lib/api';
import type { Course, NearbyResult } from '@/lib/types';

const RunMap = dynamic(() => import('@/components/RunMap'), { ssr: false });

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Course | null>(null);
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.get<Course>(`/courses/${id}`).then(setC).catch((e) => setErr(e.message)); }, [id]);
  useEffect(() => {
    if (!c) return;
    const lat = c.startLat || c.polyline?.[0]?.[0];
    const lng = c.startLng || c.polyline?.[0]?.[1];
    if (lat == null || lng == null) return;
    api.get<NearbyResult>(`/tour/nearby?lat=${lat}&lng=${lng}&radius=1500&limit=6`).then(setNearby).catch(() => setNearby(null));
  }, [c]);
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
      <div className="section-title data-section-title"><div><h2>출발점 주변 관광정보</h2>{nearby && <LiveBadge source={nearby.source} ms={nearby.fetchedMs} label={nearby.cached ? 'TourAPI 캐시' : 'TourAPI'}/>}</div><span>한국관광공사 locationBasedList2 · 반경 1.5km</span></div>
      <div className="stack">{(nearby?.items ?? []).slice(0, 4).map((p) => <div className="list-item" key={p.contentId ?? `${p.title}-${p.lat}`}><span className="ic">{p.contentTypeId === 39 ? '🍽' : p.contentTypeId === 28 ? '🚣' : '📍'}</span><div><h4>{p.title}</h4><p>{p.addr1 ?? ''}{p.dist != null ? ` · ${p.dist}m` : ''}</p></div><span className="tag green">LIVE</span></div>)}</div>
      {!nearby && <div className="empty compact">실시간 관광정보를 불러오는 중…</div>}
      <div className="section-title"><h2>코스에 등록된 경유 장소 {(c.pois ?? []).length}곳</h2><span>러닝 중 실시간 데이터와 함께 사용</span></div>
      <div className="stack">{(c.pois ?? []).map((p) => <div className="list-item" key={p.poiId}><span className="ic">{p.poi.contentTypeId === 39 ? '🍽' : p.poi.contentTypeId === 28 ? '🚣' : '📍'}</span><div><h4>{p.poi.title}</h4><p>{p.poi.addr1 ?? ''} · {(p.distFromStartM / 1000).toFixed(1)}km 지점</p></div><span className="tag">{p.poi.source === 'TOURAPI' ? 'TourAPI 캐시' : '코스 등록'}</span></div>)}</div>
      <div style={{ marginTop: 16 }}><Link className="btn" href={`/run/${c.slug}`}>이 코스로 러닝 시작</Link></div>
    </main>
  );
}
