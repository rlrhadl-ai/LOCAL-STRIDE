'use client';
import { useCallback, useEffect, useState } from 'react';
import { useDaeguArea } from '@/components/DaeguAreaProvider';
import { daeguAreaByName } from './daegu-areas';

export function useDaeguAreaFilter() {
  const { area: selectedArea, ready, setAreaSlug } = useDaeguArea();
  const [areaFilter, setAreaFilterState] = useState(selectedArea.name);

  useEffect(() => {
    if (!ready) return;
    const requested = new URLSearchParams(window.location.search).get('area');
    if (requested === 'all') return setAreaFilterState('전체');
    const resolved = requested ? daeguAreaByName(requested) : selectedArea;
    setAreaFilterState(resolved.name);
    if (requested) setAreaSlug(resolved.slug);
  }, [ready, selectedArea, setAreaSlug]);

  const setAreaFilter = useCallback((value: string) => {
    setAreaFilterState(value);
    const next = value === '전체' ? null : daeguAreaByName(value);
    if (next) setAreaSlug(next.slug);
    const url = new URL(window.location.href);
    url.searchParams.set('area', next?.slug || 'all');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [setAreaSlug]);

  return { areaFilter, setAreaFilter, ready };
}
