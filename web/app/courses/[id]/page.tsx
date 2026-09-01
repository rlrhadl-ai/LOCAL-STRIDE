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
  if (err) return <main className="page"><AppHeader back title="코스" /><div className="course-load-error"><span>코스를 불러오지 못했어요</span><strong>잠시 후 다시 확인해 주세요.</strong><p>{err}</p><div><button type="button" onClick={() => window.location.reload()}>다시 시도</button><Link href="/courses">코스 목록</Link></div></div></main>;
  if (!c) return <main className="page"><AppHeader back title="코스" /><div className="empty">불러오는 중…</div></main>;
  const cps = c.checkpoints ?? [];
  const startName = cps[0]?.name || c.areaName || '등록된 출발점';
  return (
    <main className="page course-detail-page">
      <AppHeader back title={c.name} />
      <div className="map-wrap course-detail-map">
        <RunMap route={c.polyline} done={[]} checkpoints={cps} cpState={() => ''} runner={null} pois={(c.pois ?? []).map((p) => p.poi)} />
      </div>
      <section className="course-overview-card" aria-label="코스 핵심 정보">
        <div className="course-overview-heading"><div><span>START</span><strong>{startName}</strong></div><span className="tag">{c.difficulty}</span></div>
        <div className="course-overview-metrics"><span><small>거리</small><b>{(c.distanceM / 1000).toFixed(1)}km</b></span><span><small>예상 시간</small><b>{c.estMinutes}분</b></span><span><small>누적 고도</small><b>{c.elevationGainM}m</b></span></div>
        <p>{c.description}</p>
        <div className="course-overview-tags">{c.themes.map((t) => <span key={t}>{t}</span>)}{c.source === 'USER' && <span>사용자 제안</span>}</div>
        <div className="course-safety-note"><b>안전 확인</b><span>체크포인트 {cps.length}곳 · 보행·통행 상태는 출발 전 현장에서 한 번 더 확인해 주세요.</span></div>
        <Link className="btn gold course-start-button" href={`/run/${c.slug}`}>이 코스로 러닝 시작 <span aria-hidden>→</span></Link>
      </section>
      <div className="section-title"><h2>체크포인트 {cps.length}곳</h2><span>{cps.length ? `${cps[0].radiusM}m 반경 자동 체크인` : ''}</span></div>
      <div className="stack">{cps.map((cp, i) => <div className="mission" key={cp.id}><span className="n">{i === cps.length - 1 && i > 0 ? 'F' : i === 0 ? 'S' : i}</span><div><h4>{cp.name}</h4><p>{cp.kind} · {(cp.distM / 1000).toFixed(1)}km{cp.dataSource ? ` · ${cp.dataSource}` : ''}</p></div>{cp.reward && <span className="tag gold">리워드</span>}</div>)}</div>
      <div className="section-title data-section-title"><div><h2>출발점 주변 관광정보</h2>{nearby && <LiveBadge source={nearby.source} ms={nearby.fetchedMs} label={nearby.cached ? 'TourAPI 캐시' : 'TourAPI'}/>}</div><span>한국관광공사 locationBasedList2 · 반경 1.5km</span></div>
      <div className="stack">{(nearby?.items ?? []).slice(0, 4).map((p) => <div className="list-item" key={p.contentId ?? `${p.title}-${p.lat}`}><span className="ic">{p.contentTypeId === 39 ? '🍽' : p.contentTypeId === 28 ? '🚣' : '📍'}</span><div><h4>{p.title}</h4><p>{p.addr1 ?? ''}{p.dist != null ? ` · ${p.dist}m` : ''}</p></div><span className="tag green">LIVE</span></div>)}</div>
      {!nearby && <div className="empty compact">실시간 관광정보를 불러오는 중…</div>}
      <div className="section-title"><h2>코스에 등록된 경유 장소 {(c.pois ?? []).length}곳</h2><span>러닝 중 실시간 데이터와 함께 사용</span></div>
      <div className="stack">{(c.pois ?? []).map((p) => <div className="list-item" key={p.poiId}><span className="ic">{p.poi.contentTypeId === 39 ? '🍽' : p.poi.contentTypeId === 28 ? '🚣' : '📍'}</span><div><h4>{p.poi.title}</h4><p>{p.poi.addr1 ?? ''} · {(p.distFromStartM / 1000).toFixed(1)}km 지점</p></div><span className="tag">{p.poi.source === 'TOURAPI' ? 'TourAPI 캐시' : '코스 등록'}</span></div>)}</div>
    </main>
  );
}
