import type { LatLng } from './types';
const R = 6371000; const rad = (d: number) => (d * Math.PI) / 180;
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
export function cumulative(points: LatLng[]): number[] { const cum = [0]; for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + haversine(points[i - 1], points[i])); return cum; }
export function pointAt(points: LatLng[], cum: number[], d: number): LatLng {
  const total = cum[cum.length - 1]; d = Math.max(0, Math.min(total, d));
  let i = 0; while (i < cum.length - 2 && cum[i + 1] < d) i++;
  const seg = cum[i + 1] - cum[i] || 1; const f = (d - cum[i]) / seg;
  return [points[i][0] + (points[i + 1][0] - points[i][0]) * f, points[i][1] + (points[i + 1][1] - points[i][1]) * f];
}
export function sliceTo(points: LatLng[], cum: number[], d: number): LatLng[] { let i = 0; while (i < cum.length - 2 && cum[i + 1] < d) i++; return points.slice(0, i + 1).concat([pointAt(points, cum, d)]); }
