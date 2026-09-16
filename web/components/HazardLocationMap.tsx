'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { LatLng } from '@/lib/types';
import { MAP_TILE_URL, MAP_TILE_ATTRIBUTION } from '@/lib/map-tiles';

function Picker({ route, point, onPick }: { route: LatLng[]; point: LatLng | null; onPick?: (p: LatLng) => void }) {
  const map = useMap();
  useEffect(() => { if (route.length > 1) map.fitBounds(L.latLngBounds(route), { padding: [24, 24], maxZoom: 16 }); }, [map, route]);
  useEffect(() => { if (point) map.panTo(point); }, [map, point]);
  useMapEvents({ click: (event) => onPick?.([event.latlng.lat, event.latlng.lng]) });
  return point ? <CircleMarker center={point} radius={10} pathOptions={{ color: '#ba2f30', fillColor: '#ffd166', fillOpacity: 1 }} /> : null;
}
export default function HazardLocationMap(props: { route: LatLng[]; point: LatLng | null; onPick?: (p: LatLng) => void }) {
  return <MapContainer center={props.point ?? props.route[0] ?? [35.8277, 128.6177]} zoom={15} scrollWheelZoom={false} style={{ height: 260, width: '100%' }}>
    <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} />
    <Polyline positions={props.route} pathOptions={{ color: '#1b5bdf', weight: 4 }} /><Picker {...props} />
  </MapContainer>;
}
