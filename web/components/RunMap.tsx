'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Checkpoint, LatLng, Poi } from '@/lib/types';

const cpIcon = (label: string, state: string, finish: boolean) => L.divIcon({ className: 'cp', html: `<span class="cp-dot ${state} ${finish ? 'finish' : ''}">${label}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
const runnerIcon = L.divIcon({ className: 'runner', html: '<span class="runner-dot"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
const poiIcon = (t: number) => L.divIcon({ className: 'poi', html: `<span class="poi-pin t${t}"></span>`, iconSize: [24, 24], iconAnchor: [12, 24] });

function Fit({ route }: { route: LatLng[] }) {
  const map = useMap();
  useEffect(() => { if (route.length > 1) { map.invalidateSize(); map.fitBounds(L.latLngBounds(route.map(([a, b]) => L.latLng(a, b))), { padding: [26, 26] }); } }, [map, route]);
  return null;
}
function Follow({ pos, on }: { pos: LatLng | null; on: boolean }) {
  const map = useMap();
  useEffect(() => { if (on && pos && !map.getBounds().pad(-0.2).contains(L.latLng(pos[0], pos[1]))) map.panTo(L.latLng(pos[0], pos[1])); }, [map, pos, on]);
  return null;
}

export default function RunMap({ route, done, checkpoints, cpState, runner, pois, follow = false, height }: { route: LatLng[]; done: LatLng[]; checkpoints: Checkpoint[]; cpState: (i: number) => string; runner: LatLng | null; pois: Poi[]; follow?: boolean; height?: number }) {
  const center = route[0] ?? [35.8277, 128.6177];
  const last = checkpoints.length - 1;
  return (
    <MapContainer center={center} zoom={15} zoomSnap={0.1} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} attributionControl style={{ height: height ?? '100%', width: '100%' }}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="© OpenStreetMap © CARTO" subdomains="abcd" maxZoom={19} />
      <Fit route={route} />
      <Follow pos={runner} on={follow} />
      <Polyline positions={route} pathOptions={{ color: '#B9C5E6', weight: 6, lineCap: 'round', lineJoin: 'round' }} />
      {done.length > 1 && <Polyline positions={done} pathOptions={{ color: '#1B5BDF', weight: 6, lineCap: 'round', lineJoin: 'round' }} />}
      {checkpoints.map((c, i) => (i === 0 && last > 0 ? null : <Marker key={c.id} position={[c.lat, c.lng]} icon={cpIcon(i === last ? (last > 0 ? 'S/F' : 'S') : String(i), cpState(i), i === last)} interactive={false} zIndexOffset={i === last ? 500 : 0} />))}
      {pois.map((p, i) => <Marker key={p.contentId ?? `${p.title}-${i}`} position={[p.lat, p.lng]} icon={poiIcon(p.contentTypeId)} interactive={false} />)}
      {runner && <Marker position={runner} icon={runnerIcon} interactive={false} zIndexOffset={1000} />}
    </MapContainer>
  );
}
