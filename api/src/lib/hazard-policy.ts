import { z } from 'zod';
import { haversine, mPerDegLng, M_PER_DEG_LAT, type LatLng } from './geo';

export const categories = ['SURFACE', 'FACILITY', 'OBSTRUCTION', 'LIGHTING', 'OTHER'] as const;
export const statuses = ['RECEIVED', 'CONFIRMED', 'IN_PROGRESS', 'RESOLVED', 'HIDDEN'] as const;
export const reportBody = z.object({
  requestId: z.string().uuid(), courseId: z.string().min(1).max(100),
  category: z.enum(categories), severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  description: z.string().trim().min(5).max(500),
  lat: z.coerce.number().finite().min(33).max(39),
  lng: z.coerce.number().finite().min(124).max(132),
  locationSource: z.enum(['GPS', 'MAP']),
  accuracyM: z.coerce.number().finite().min(0).max(10000).optional(),
  consent: z.literal('true'),
}).refine((v) => v.locationSource !== 'GPS' || (v.accuracyM != null && v.accuracyM <= 100), {
  message: 'GPS 정확도가 낮습니다. 위치를 다시 확인하거나 지도에서 지점을 선택해 주세요.', path: ['accuracyM'],
});

// Segment projection rather than vertex distance, so long straight course sections also work.
export function distanceToRoute(point: LatLng, route: unknown): number {
  if (!Array.isArray(route)) return Infinity;
  const points = route.filter((p): p is LatLng => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
  if (!points.length) return Infinity;
  if (points.length === 1) return haversine(point, points[0]);
  let closest = Infinity;
  const xScale = mPerDegLng(point[0]);
  for (let i = 1; i < points.length; i++) {
    const a = [(points[i - 1][1] - point[1]) * xScale, (points[i - 1][0] - point[0]) * M_PER_DEG_LAT];
    const b = [(points[i][1] - point[1]) * xScale, (points[i][0] - point[0]) * M_PER_DEG_LAT];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / (dx * dx + dy * dy || 1)));
    closest = Math.min(closest, Math.hypot(a[0] + dx * t, a[1] + dy * t));
  }
  return closest;
}

export const reviewed = (status: string) => ['CONFIRMED', 'IN_PROGRESS', 'RESOLVED'].includes(status);
export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const reportSelect = {
  id: true, courseId: true, category: true, severity: true, status: true, description: true,
  lat: true, lng: true, accuracyM: true, locationSource: true, version: true,
  publicNote: true, createdAt: true, updatedAt: true,
  course: { select: { id: true, slug: true, name: true, areaName: true } },
} as const;

export function publicReport<T extends { id: string; status: string; description: string; publicNote: string }>(item: T) {
  return { ...item, description: reviewed(item.status) ? item.description : '',
    publicNote: reviewed(item.status) ? item.publicNote : '',
    photoUrl: reviewed(item.status) ? `/api/hazards/${item.id}/photo` : null };
}
