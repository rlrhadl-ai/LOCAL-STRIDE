'use client';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { useDaeguArea } from '@/components/DaeguAreaProvider';
import LiveBadge from '@/components/LiveBadge';
import { api } from '@/lib/api';
import { DAEGU_AREAS, daeguAreaByName } from '@/lib/daegu-areas';
import type { NearbyResult, Poi } from '@/lib/types';

const KIND: Record<number, string> = { 12: '관광지', 14: '문화', 28: '레포츠' };

export default function SpotsPage() {
  const { area, ready, setAreaSlug } = useDaeguArea();
  const [items, setItems] = useState<Poi[]>([]);
  const [result, setResult] = useState<NearbyResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('area');
    if (requested) setAreaSlug(daeguAreaByName(requested).slug);
  }, [setAreaSlug]);
  useEffect(() => {
    if (!ready) return;
    let alive = true; setLoading(true); setItems([]); setResult(null);
    window.history.replaceState(null, '', `/spots?area=${area.slug}`);
    api.get<NearbyResult>(`/tour/nearby?lat=${area.lat}&lng=${area.lng}&radius=5000&limit=20`).then((next) => {
      if (!alive) return; setResult(next); setItems(next.items.filter((item) => [12, 14, 28].includes(item.contentTypeId)));
    }).catch(() => alive && setItems([])).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [area, ready]);

  return <main className="page local-content-page">
    <AppHeader back title="대구 로컬 스폿"/>
    <section className="local-content-intro spot"><span>RUN · LOOK · STAY</span><h1>달리다 잠시 멈춰도<br/>좋은 대구의 장소</h1><p>대구 9개 구·군의 러닝 거점을 기준으로 가까운 관광지와 문화 공간을 찾아드려요.</p></section>
    <section className="area-switcher"><div><span>EXPLORE AREA</span><strong>{area.fullName}</strong><small>{area.hub} 기준 반경 5km</small></div><select aria-label="대구 지역 선택" value={area.slug} onChange={(event) => setAreaSlug(event.target.value)}>{DAEGU_AREAS.map((option) => <option value={option.slug} key={option.slug}>{option.name} · {option.hub}</option>)}</select></section>
    <div className="area-chip-scroll" aria-label="대구 9개 구·군">{DAEGU_AREAS.map((option) => <button type="button" className={area.slug === option.slug ? 'on' : ''} onClick={() => setAreaSlug(option.slug)} key={option.slug}>{option.name}</button>)}</div>
    <div className="public-data-proof"><LiveBadge source={result?.source} ms={result?.fetchedMs} label={result?.cached ? '한국관광공사 TourAPI 캐시' : '한국관광공사 TourAPI'}/><span>locationBasedList2 · {area.hub} 반경 5km</span></div>
    <div className="local-content-head"><h2>{area.hub} 가까이</h2><span>{loading ? '불러오는 중' : `${items.length}곳`}</span></div>
    <div className="spot-page-list">{items.map((spot) => <article className="spot-page-card" key={spot.contentId ?? `${spot.title}-${spot.lat}`}>
      <div className="spot-page-image">{spot.firstImage ? <img src={spot.firstImage} alt=""/> : <span>DAEGU<br/>LOCAL</span>}<em>{KIND[spot.contentTypeId] ?? '로컬 스폿'}</em></div>
      <div><small>{spot.dist != null ? `${area.hub}에서 약 ${(spot.dist / 1000).toFixed(1)}km` : area.fullName}</small><h2>{spot.title}</h2><p>{spot.overview || spot.addr1 || '러닝 전후에 가볍게 둘러보기 좋은 대구의 장소입니다.'}</p>{spot.addr1 && <address>{spot.addr1}</address>}</div>
    </article>)}</div>
    {!loading && items.length === 0 && <div className="empty">이 지역의 주변 장소를 잠시 불러오지 못했어요.</div>}
  </main>;
}
