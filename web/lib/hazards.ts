'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_URL, deviceId, ApiError } from './api';

export const HAZARD_CATEGORY = { SURFACE: '노면 파손', FACILITY: '시설물 파손', OBSTRUCTION: '통행 방해', LIGHTING: '조명 불량', OTHER: '기타 불편' };
export const HAZARD_STATUS = { RECEIVED: '확인 전', CONFIRMED: '확인 완료', IN_PROGRESS: '처리 중', RESOLVED: '해결 완료', HIDDEN: '비공개' };
export const HAZARD_SEVERITY = { LOW: '불편', MEDIUM: '주의', HIGH: '위험' };
export type Hazard = {
  id: string; courseId: string; category: keyof typeof HAZARD_CATEGORY; severity: keyof typeof HAZARD_SEVERITY;
  status: keyof typeof HAZARD_STATUS; description: string; lat: number; lng: number; accuracyM: number | null;
  locationSource: 'GPS' | 'MAP'; photoUrl?: string | null; publicNote: string; version: number;
  createdAt: string; updatedAt: string; course: { id: string; name: string; slug: string; areaName: string };
};
export type HazardHistory = { id: string; status: Hazard['status']; note: string; createdAt: string; admin: { nickname: string } };
export const hazardPhotoUrl = (id: string) => `${API_URL}/api/hazards/${encodeURIComponent(id)}/photo`;

export async function sendHazard(body: FormData) {
  const res = await fetch(`${API_URL}/api/hazards`, { method: 'POST', credentials: 'include', headers: { 'x-device-id': deviceId() }, body });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || '전송하지 못했어요. 내용을 유지했으니 다시 시도해 주세요.');
  return data as { id: string };
}

export function useHazards(courseId?: string) {
  const [items, setItems] = useState<Hazard[]>([]), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const page = useRef(1), generation = useRef(0), pending = useRef(false);
  const load = useCallback(async (more = false) => {
    if (!courseId || (more && pending.current)) return;
    if (!more) generation.current++;
    const ticket = generation.current, target = more ? page.current + 1 : 1;
    pending.current = true; setLoading(true); setError('');
    try {
      const result = await api.get<{ items: Hazard[]; total: number }>(`/hazards?courseId=${encodeURIComponent(courseId)}&page=${target}`);
      if (ticket !== generation.current) return;
      setItems((current) => more ? [...new Map([...current, ...result.items].map((r) => [r.id, r])).values()] : result.items);
      setTotal(result.total); page.current = target;
    } catch (e) { if (ticket === generation.current) setError(e instanceof Error ? e.message : '신고 현황을 불러오지 못했어요.'); }
    finally { if (ticket === generation.current) { pending.current = false; setLoading(false); } }
  }, [courseId]);
  useEffect(() => {
    const tickets = generation;
    generation.current++; pending.current = false; page.current = 1; setItems([]); setTotal(0);
    if (!courseId) return;
    void load();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { tickets.current++; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [courseId, load]);
  return { items, total, loading, error, refresh: () => load(), loadMore: () => load(true) };
}
