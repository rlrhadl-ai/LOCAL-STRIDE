'use client';
import { CircleMarker, Popup } from 'react-leaflet';
import { HAZARD_CATEGORY, HAZARD_STATUS, type Hazard } from '@/lib/hazards';

export default function HazardMarkers({ items }: { items: Hazard[] }) {
  return <>{items.map((r) => <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={10} pathOptions={{ color: r.status === 'RECEIVED' ? '#9b6500' : '#ba2f30', fillColor: r.status === 'RECEIVED' ? '#ffd166' : '#ff6666', fillOpacity: .95, weight: 3 }}>
    <Popup><strong>{HAZARD_CATEGORY[r.category]}</strong><p>{HAZARD_STATUS[r.status]} · {new Date(r.createdAt).toLocaleDateString('ko-KR')}</p><p>{r.description || '이용자가 접수한 신고입니다. 운영자가 내용을 확인하고 있어요.'}</p>{r.publicNote && <p>처리 안내: {r.publicNote}</p>}</Popup>
  </CircleMarker>)}</>;
}
