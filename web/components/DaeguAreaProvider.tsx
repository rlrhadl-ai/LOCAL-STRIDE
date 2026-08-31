'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DAEGU_AREA_STORAGE_KEY, DEFAULT_DAEGU_AREA, daeguAreaByName, nearestDaeguArea, type DaeguArea } from '@/lib/daegu-areas';

interface LocateResult { area: DaeguArea; distanceKm: number }
interface DaeguAreaContextValue {
  area: DaeguArea;
  ready: boolean;
  setAreaSlug: (value: string) => void;
  locateNearest: () => Promise<LocateResult>;
}

const DaeguAreaContext = createContext<DaeguAreaContextValue | null>(null);

export function DaeguAreaProvider({ children }: { children: React.ReactNode }) {
  const [areaSlug, setAreaSlugState] = useState(DEFAULT_DAEGU_AREA.slug);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DAEGU_AREA_STORAGE_KEY);
      if (saved) setAreaSlugState(daeguAreaByName(saved).slug);
    } catch { /* storage is optional */ }
    setReady(true);
  }, []);

  const setAreaSlug = useCallback((value: string) => {
    const next = daeguAreaByName(value);
    setAreaSlugState(next.slug);
    try { localStorage.setItem(DAEGU_AREA_STORAGE_KEY, next.slug); } catch { /* storage is optional */ }
  }, []);

  const locateNearest = useCallback(() => new Promise<LocateResult>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('이 기기에서는 위치 찾기를 지원하지 않아요.'));
    navigator.geolocation.getCurrentPosition((position) => {
      const nearest = nearestDaeguArea(position.coords.latitude, position.coords.longitude);
      setAreaSlug(nearest.area.slug);
      resolve(nearest);
    }, (error) => {
      const message = error.code === error.PERMISSION_DENIED ? '위치 권한이 꺼져 있어요. 지역을 직접 선택해 주세요.' : '현재 위치를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
      reject(new Error(message));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }), [setAreaSlug]);

  const area = daeguAreaByName(areaSlug);
  const value = useMemo(() => ({ area, ready, setAreaSlug, locateNearest }), [area, locateNearest, ready, setAreaSlug]);
  return <DaeguAreaContext.Provider value={value}>{children}</DaeguAreaContext.Provider>;
}

export function useDaeguArea() {
  const value = useContext(DaeguAreaContext);
  if (!value) throw new Error('useDaeguArea must be used inside DaeguAreaProvider');
  return value;
}
