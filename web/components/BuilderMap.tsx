'use client';
import { MapContainer, TileLayer, Polyline, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';
import type { LatLng } from '@/lib/types';

const dot = (n: number) => L.divIcon({ className: 'cp', html: `<span class="cp-dot ${n === 0 ? 'done' : ''}">${n === 0 ? 'S' : n}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
function Clicks({ onAdd }: { onAdd: (p: LatLng) => void }) { useMapEvents({ click: (e) => onAdd([e.latlng.lat, e.latlng.lng]) }); return null; }
function Locate({ center }: { center: LatLng }) { const map = useMap(); useEffect(() => { map.setView(center, 15); }, [map, center]); return null; }

export default function BuilderMap({ points, onAdd, center }: { points: LatLng[]; onAdd: (p: LatLng) => void; center: LatLng }) {
  return (
    <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} attributionControl>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="© OpenStreetMap © CARTO" subdomains="abcd" maxZoom={19} />
      <Locate center={center} />
      <Clicks onAdd={onAdd} />
      {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#1B5BDF', weight: 5 }} />}
      {points.map((p, i) => <Marker key={i} position={p} icon={dot(i)} interactive={false} />)}
    </MapContainer>
  );
}
