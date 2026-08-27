'use client';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import type { NearbyResult, Poi } from '@/lib/types';

const KIND: Record<number, string> = { 12: '관광지', 14: '문화', 28: '레포츠' };

export default function SpotsPage() {
  const [items, setItems] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get<NearbyResult>('/tour/nearby?lat=35.8277&lng=128.6177&radius=5000&limit=12').then((result) => setItems(result.items.filter((item) => [12, 14, 28].includes(item.contentTypeId)))).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  return <main className="page local-content-page">
    <AppHeader back title="대구 로컬 스폿"/>
    <section className="local-content-intro spot"><span>RUN · LOOK · STAY</span><h1>달리다 잠시 멈춰도<br/>좋은 대구의 장소</h1><p>수성못 러닝을 기준으로 가까운 관광지와 문화 공간을 모았습니다.</p></section>
    <div className="local-content-head"><h2>수성못 가까이</h2><span>{items.length}곳</span></div>
    <div className="spot-page-list">{items.map((spot) => <article className="spot-page-card" key={spot.contentId ?? `${spot.title}-${spot.lat}`}>
      <div className="spot-page-image">{spot.firstImage ? <img src={spot.firstImage} alt=""/> : <span>DAEGU<br/>LOCAL</span>}<em>{KIND[spot.contentTypeId] ?? '로컬 스폿'}</em></div>
      <div><small>{spot.dist != null ? `수성못에서 약 ${(spot.dist / 1000).toFixed(1)}km` : '대구 수성구'}</small><h2>{spot.title}</h2><p>{spot.overview || spot.addr1 || '러닝 전후에 가볍게 둘러보기 좋은 대구의 장소입니다.'}</p>{spot.addr1 && <address>{spot.addr1}</address>}</div>
    </article>)}</div>
    {!loading && items.length === 0 && <div className="empty">주변 장소를 잠시 불러오지 못했어요.</div>}
  </main>;
}
