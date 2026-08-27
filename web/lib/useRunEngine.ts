'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { cumulative, haversine, pointAt, sliceTo } from './geo';
import { speak, voiceOn } from './speech';
import type { Course, CoursePoi, FinishSummary, LatLng, NearbyResult, Poi, Run } from './types';
import type { LogEntry, LogKind } from '@/components/AgentLog';
import { fmtTime } from './types';

export type Mode = 'DEMO' | 'LIVE';
const PACE_SEC = 372; // 데모 재생 페이스 6'12"/km
const BASE_SEC = 48;  // ×1 재생 시 5km 기준 실시간(초) — 거리에 비례
const CT = (t: number) => ({ 12: '관광지', 14: '문화시설', 15: '축제', 25: '여행코스', 28: '레포츠', 32: '숙박', 38: '쇼핑', 39: '음식점' } as Record<number, string>)[t] ?? '장소';

export interface PushItem { title: string; type: string; status: string; desc: string; voice: string; contentTypeId: number; firstImage: string | null; source: 'COURSE' | 'TOURAPI' | 'SEED'; reward?: boolean }
export interface EngineState {
  status: 'idle' | 'starting' | 'running' | 'paused' | 'finishing' | 'finished' | 'error';
  runId: string | null; progress: number; elapsedSec: number; runner: LatLng | null; done: LatLng[]; nextCp: number; checkedIn: Set<number>;
  push: PushItem | null; pois: Poi[]; log: LogEntry[]; nearbySource: NearbyResult['source'] | null; nearbyMs: number | null; lastRaw: unknown; gpsNote: string | null; gpsAccuracyM: number | null; error: string | null;
}

export function useRunEngine(course: Course | null, mode: Mode, speed: number) {
  const [s, setS] = useState<EngineState>({ status: 'idle', runId: null, progress: 0, elapsedSec: 0, runner: null, done: [], nextCp: 1, checkedIn: new Set([0]), push: null, pois: [], log: [], nearbySource: null, nearbyMs: null, lastRaw: null, gpsNote: null, gpsAccuracyM: null, error: null });
  const r = useRef({ progress: 0, nextCp: 1, seen: new Set<string>(), raf: 0, lastTs: 0, paused: false, runId: '' as string, cps: [] as Course['checkpoints'], pois: [] as CoursePoi[], route: [] as LatLng[], cum: [] as number[], total: 0, lastQueryAt: -1e9, trackBuf: [] as { lat: number; lng: number; t: number; accuracy: number }[], lastTrackSent: 0, flushPromise: null as Promise<void> | null, watch: null as number | null, lastFix: null as LatLng | null, lastFixAt: 0, elapsed: 0, startedAt: 0, pushTimer: 0, speed, mode, finishing: false, checkinPending: false, log: [] as LogEntry[] });
  r.current.speed = speed; r.current.mode = mode;

  const clock = () => (r.current.mode === 'DEMO' ? fmtTime((r.current.progress / 1000) * PACE_SEC) : fmtTime(r.current.elapsed));
  const log = useCallback((kind: LogKind, text: string) => { r.current.log = [{ t: clock(), kind, text }, ...r.current.log].slice(0, 30); setS((p) => ({ ...p, log: r.current.log })); }, []);
  const setPush = (push: PushItem | null) => { setS((p) => ({ ...p, push })); clearTimeout(r.current.pushTimer); if (push) r.current.pushTimer = window.setTimeout(() => setS((p) => ({ ...p, push: null })), 7000 / r.current.speed); };

  const discover = (item: PushItem, key: string, ll: LatLng, dist: number) => {
    r.current.seen.add(key);
    setS((p) => ({ ...p, pois: [...p.pois, { contentId: key, contentTypeId: item.contentTypeId, title: item.title, addr1: null, lat: ll[0], lng: ll[1], firstImage: item.firstImage }] }));
    setPush(item);
    log('sense', `${item.title} ${Math.round(dist)}m 접근`);
    log('decide', `반경 500m 후보 중 '${item.title}' — 미방문 · ${item.type} · ${item.source === 'TOURAPI' ? 'TourAPI 실시간' : item.source === 'COURSE' ? '코스 등록 장소' : '저장 데이터'}`);
    log('act', `푸시 알림 + 음성 가이드${item.reward ? ' + 완주 쿠폰 사용처 표시' : ''}`);
    speak(item.voice);
  };

  /** 코스 POI(시드) + TourAPI 실시간 조회 — 250m 이동마다 */
  const checkDiscovery = async (ll: LatLng, progress: number) => {
    for (const cp of r.current.pois) {
      const key = cp.poi.contentId ?? cp.poi.id ?? cp.poi.title;
      if (r.current.seen.has(key)) continue;
      const d = haversine(ll, [cp.poi.lat, cp.poi.lng]);
      if (d < cp.triggerRadiusM && progress >= cp.distFromStartM - 400) discover({ title: cp.poi.title, type: CT(cp.poi.contentTypeId), status: '지금 지나고 있어요!', desc: cp.poi.overview ?? cp.poi.addr1 ?? '', voice: cp.voice ?? `${cp.poi.title}을 지나고 있습니다.`, contentTypeId: cp.poi.contentTypeId, firstImage: cp.poi.firstImage, source: 'COURSE', reward: cp.poi.contentTypeId === 39 }, key, [cp.poi.lat, cp.poi.lng], d);
    }
    if (progress - r.current.lastQueryAt < 250) return;
    r.current.lastQueryAt = progress;
    try {
      const res = await api.get<NearbyResult>(`/tour/nearby?lat=${ll[0]}&lng=${ll[1]}&radius=500&limit=10`);
      setS((p) => ({ ...p, nearbySource: res.source, nearbyMs: res.fetchedMs, lastRaw: res.raw ?? p.lastRaw }));
      if (res.source === 'TOURAPI') {
        const it = res.items.find((x) => x.contentId && !r.current.seen.has(x.contentId) && [12, 14, 28, 39].includes(x.contentTypeId) && (x.dist ?? 999) < 200);
        if (it) discover({ title: it.title, type: CT(it.contentTypeId), status: `${it.dist}m 앞 · TourAPI locationBasedList2`, desc: it.addr1 ?? '', voice: `${it.title}이 ${it.dist}미터 앞에 있습니다.`, contentTypeId: it.contentTypeId, firstImage: it.firstImage, source: 'TOURAPI' }, it.contentId!, [it.lat, it.lng], it.dist ?? 0);
      }
    } catch { /* 네트워크 실패는 무시 (코스 POI 는 계속 동작) */ }
  };

  const checkinServer = async (i: number, ll: LatLng, method: 'DEMO' | 'GPS', t = Date.now(), accuracy = 0) => {
    if (r.current.checkinPending) return false;
    r.current.checkinPending = true;
    const cp = r.current.cps![i];
    try {
      if (method === 'GPS') await flushTrack(true);
      await api.post(`/runs/${r.current.runId}/checkin`, { checkpointId: cp.id, lat: ll[0], lng: ll[1], t, accuracy, method });
      r.current.nextCp = i + 1;
      setS((p) => { const c = new Set(p.checkedIn); c.add(i); return { ...p, nextCp: i + 1, checkedIn: c }; });
      if (i < r.current.cps!.length - 1) { log('sense', `체크포인트 ${i} '${cp.name}' ${cp.radiusM}m 반경 진입`); log('act', `GPS 궤적 확인 · 자동 체크인 저장 · 미션 ${i + 1}/${r.current.cps!.length}${cp.reward ? ' · 리워드 대상 구간' : ''}`); }
      return true;
    } catch (e: any) {
      log('sense', `체크인 실패: ${e.message}`);
      return false;
    } finally {
      r.current.checkinPending = false;
    }
  };

  const flushTrack = async (force = false) => {
    if (r.current.flushPromise) {
      await r.current.flushPromise;
      if (!force) return;
    }
    const now = Date.now();
    if (!r.current.trackBuf.length || (!force && now - r.current.lastTrackSent < 3000)) return;
    const pts = r.current.trackBuf.splice(0); r.current.lastTrackSent = now;
    const task = (async () => {
      try {
        const saved = await api.post<{ distanceM: number; points: number }>(`/runs/${r.current.runId}/track`, { points: pts });
        r.current.progress = saved.distanceM;
        setS((p) => ({ ...p, progress: saved.distanceM }));
      } catch {
        r.current.trackBuf = [...pts, ...r.current.trackBuf].slice(-500);
      } finally {
        r.current.flushPromise = null;
      }
    })();
    r.current.flushPromise = task;
    await task;
  };

  const finish = useCallback(async () => {
    if (r.current.finishing || !r.current.runId) return null;
    r.current.finishing = true;
    setS((p) => ({ ...p, status: 'finishing' }));
    await flushTrack(true);
    const durationSec = r.current.mode === 'DEMO' ? Math.round((r.current.total / 1000) * PACE_SEC) : Math.max(1, Math.round(r.current.elapsed));
    try {
      const summary = await api.post<FinishSummary>(`/runs/${r.current.runId}/finish`, { durationSec, distanceM: Math.round(r.current.progress) });
      log('decide', `완주 조건 ${summary.valid ? '충족' : '미충족'} — 체크인 ${summary.checkins}/${summary.checkpoints} · ${(summary.distanceM / 1000).toFixed(2)}km · ${summary.pace}`);
      if (summary.valid) log('act', `${summary.medal ? summary.medal.name + ' 메달 발급 · ' : ''}${summary.coupon ? summary.coupon.title + ' 쿠폰 발행 · ' : ''}${summary.challenge ? `${summary.challenge.name} ${summary.challenge.after}/${summary.challenge.target}` : ''}`);
      log('learn', `선호 테마 '${course?.themes.join('·')}' 가중치 갱신 → 다음 추천에 반영`);
      sessionStorage.setItem(`ls_finish_${r.current.runId}`, JSON.stringify({ summary, log: r.current.log, courseName: course?.name }));
      speak(summary.valid ? '완주를 축하합니다. 메달과 쿠폰이 지급되었습니다.' : '러닝을 마쳤습니다.');
      cancelAnimationFrame(r.current.raf);
      if (r.current.watch != null) navigator.geolocation.clearWatch(r.current.watch);
      setS((p) => ({ ...p, status: 'finished' }));
      return summary;
    } catch (e: any) {
      setS((p) => ({ ...p, status: 'running', error: e.message, gpsNote: e.message }));
      r.current.finishing = false;
      return null;
    }
  }, [course, log]);

  const tick = (ts: number) => {
    const c = r.current;
    if (c.paused || c.finishing) return;
    const dt = Math.min(0.1, (ts - c.lastTs) / 1000); c.lastTs = ts;
    c.progress = Math.min(c.total, c.progress + dt * c.speed * (c.total / ((c.total / 5000) * BASE_SEC)));
    const ll = pointAt(c.route, c.cum, c.progress);
    c.trackBuf.push({ lat: ll[0], lng: ll[1], t: Date.now(), accuracy: 0 });
    if (c.nextCp < c.cps!.length - 1 && c.progress >= c.cps![c.nextCp].distM) { const i = c.nextCp; c.nextCp = i + 1; void checkinServer(i, [c.cps![i].lat, c.cps![i].lng], 'DEMO'); }
    void checkDiscovery(ll, c.progress);
    void flushTrack();
    setS((p) => ({ ...p, progress: c.progress, elapsedSec: (c.progress / 1000) * PACE_SEC, runner: ll, done: sliceTo(c.route, c.cum, c.progress) }));
    if (c.progress >= c.total - 0.5) { void finish(); return; }
    c.raf = requestAnimationFrame(tick);
  };

  const onFix = (pos: GeolocationPosition) => {
    const c = r.current; if (c.finishing || c.paused) return;
    const accuracy = Math.round(pos.coords.accuracy);
    if (accuracy > 80) {
      setS((p) => ({ ...p, gpsAccuracyM: accuracy, gpsNote: `GPS 정확도 ±${accuracy}m — 탁 트인 곳으로 이동해 주세요` }));
      return;
    }
    const ll: LatLng = [pos.coords.latitude, pos.coords.longitude];
    const fixAt = Date.now();
    if (c.lastFix) {
      const d = haversine(c.lastFix, ll);
      const dt = Math.max(1, (fixAt - c.lastFixAt) / 1000);
      if (d >= 4 && d / dt <= 7) c.progress += d;
    }
    c.lastFix = ll; c.lastFixAt = fixAt; c.elapsed = (fixAt - c.startedAt) / 1000;
    c.trackBuf.push({ lat: ll[0], lng: ll[1], t: fixAt, accuracy });
    const toStart = haversine(ll, c.route[0]);
    const note = toStart > 1500 ? `코스 출발점에서 ${(toStart / 1000).toFixed(1)}km 떨어져 있습니다` : `GPS 연결됨 · 정확도 ±${accuracy}m`;
    setS((p) => ({ ...p, progress: c.progress, elapsedSec: c.elapsed, runner: ll, done: [...p.done, ll].slice(-2000), gpsNote: note, gpsAccuracyM: accuracy }));
    const nx = c.cps![c.nextCp];
    if (nx && !c.checkinPending && haversine(ll, [nx.lat, nx.lng]) <= nx.radiusM + Math.min(accuracy, 30)) {
      const i = c.nextCp;
      void checkinServer(i, ll, 'GPS', fixAt, accuracy).then((ok) => { if (ok && i >= c.cps!.length - 1) void finish(); });
    }
    void checkDiscovery(ll, c.progress); void flushTrack();
  };

  const start = useCallback(async () => {
    if (!course || r.current.runId) return;
    setS((p) => ({ ...p, status: 'starting', error: null, gpsNote: mode === 'LIVE' ? 'GPS 권한을 요청하고 현재 위치를 확인하는 중…' : null }));
    try {
      let initialPosition: GeolocationPosition | null = null;
      if (mode === 'LIVE') {
        if (!window.isSecureContext) throw new Error('실제 GPS 러닝은 HTTPS 연결에서만 사용할 수 있습니다');
        if (!('geolocation' in navigator)) throw new Error('이 기기는 GPS 위치 정보를 지원하지 않습니다');
        initialPosition = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }));
        if (initialPosition.coords.accuracy > 80) throw new Error(`GPS 정확도가 낮습니다 (±${Math.round(initialPosition.coords.accuracy)}m) — 탁 트인 곳에서 다시 시도해 주세요`);
      }
      const initialFix = initialPosition ? { lat: initialPosition.coords.latitude, lng: initialPosition.coords.longitude, t: Date.now(), accuracy: initialPosition.coords.accuracy } : undefined;
      const { run, course: full } = await api.post<{ run: Run; course: Course }>('/runs', { courseId: course.id, mode, start: initialFix });
      const c = r.current;
      c.runId = run.id; c.cps = full.checkpoints ?? []; c.pois = full.pois ?? []; c.route = full.polyline; c.cum = cumulative(full.polyline); c.total = c.cum[c.cum.length - 1];
      c.progress = 0; c.nextCp = 1; c.seen = new Set(); c.lastQueryAt = -1e9; c.startedAt = new Date(run.startedAt).getTime(); c.finishing = false; c.paused = false; c.checkinPending = false; c.log = [];
      const initialLl: LatLng = initialFix ? [initialFix.lat, initialFix.lng] : c.route[0];
      c.lastFix = initialLl; c.lastFixAt = initialFix?.t ?? Date.now();
      setS((p) => ({ ...p, status: 'running', runId: run.id, runner: initialLl, done: [], nextCp: 1, checkedIn: new Set([0]), pois: [], push: null, gpsAccuracyM: initialFix ? Math.round(initialFix.accuracy) : null, gpsNote: initialFix ? `출발점 GPS 인증 완료 · 정확도 ±${Math.round(initialFix.accuracy)}m` : null }));
      log('sense', `실제 GPS 출발 인증 · (${initialLl[0].toFixed(4)}, ${initialLl[1].toFixed(4)}) · 정확도 ±${Math.round(initialFix?.accuracy ?? 0)}m · 코스 ${(c.total / 1000).toFixed(1)}km`);
      log('decide', `코스 컨텍스트 로드 — 체크포인트 ${c.cps.length}곳 · 코스 등록 장소 ${c.pois.length}곳 · TourAPI 반경 500m 실시간 조회 · 음성 ${voiceOn() ? '켬' : '끔'}`);
      speak(`${course.name}을 시작합니다. 가볍게 출발하세요.`);
      if (mode === 'DEMO') { c.lastTs = performance.now(); c.raf = requestAnimationFrame(tick); }
      else if ('geolocation' in navigator) c.watch = navigator.geolocation.watchPosition(onFix, (err) => { setS((p) => ({ ...p, gpsNote: `GPS 위치를 받을 수 없습니다 (${err.message})` })); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
      else setS((p) => ({ ...p, gpsNote: '이 기기는 위치 정보를 지원하지 않아요' }));
    } catch (e: any) { setS((p) => ({ ...p, status: 'error', error: e.message, gpsNote: null })); }
  }, [course, mode, log]);

  const togglePause = useCallback(() => {
    const c = r.current; if (!c.runId || c.finishing) return;
    c.paused = !c.paused;
    setS((p) => ({ ...p, status: c.paused ? 'paused' : 'running' }));
    if (!c.paused && c.mode === 'DEMO') { c.lastTs = performance.now(); c.raf = requestAnimationFrame(tick); }
  }, []);

  const nextCheckpoint = useCallback(() => {
    const c = r.current; if (!c.runId || c.mode !== 'DEMO' || c.finishing) return;
    if (c.nextCp >= c.cps!.length - 1) { void finish(); return; }
    c.progress = c.cps![c.nextCp].distM; const i = c.nextCp; c.nextCp = i + 1;
    void checkinServer(i, [c.cps![i].lat, c.cps![i].lng], 'DEMO');
    setS((p) => ({ ...p, progress: c.progress, runner: pointAt(c.route, c.cum, c.progress), done: sliceTo(c.route, c.cum, c.progress) }));
    c.lastTs = performance.now();
  }, [finish]);

  useEffect(() => () => { cancelAnimationFrame(r.current.raf); if (r.current.watch != null) navigator.geolocation.clearWatch(r.current.watch); clearTimeout(r.current.pushTimer); }, []);

  const total = r.current.total || course?.distanceM || 0;
  return { s, start, togglePause, finish, nextCheckpoint, total, closePush: () => setPush(null), log };
}
