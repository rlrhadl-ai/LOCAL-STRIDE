'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { cumulative, haversine, pointAt, sliceTo } from './geo';
import { speak, voiceOn } from './speech';
import type { ActiveRun, Course, CoursePoi, FinishSummary, LatLng, NearbyResult, Poi, Run, RunTrackPoint } from './types';
import type { LogEntry, LogKind } from '@/components/AgentLog';
import { fmtTime } from './types';

export type Mode = 'DEMO' | 'LIVE';
const PACE_SEC = 372; // 데모 재생 페이스 6'12"/km
const BASE_SEC = 48;  // ×1 재생 시 5km 기준 실시간(초) — 거리에 비례
const CT = (t: number) => ({ 12: '관광지', 14: '문화시설', 15: '축제', 25: '여행코스', 28: '레포츠', 32: '숙박', 38: '쇼핑', 39: '음식점' } as Record<number, string>)[t] ?? '장소';
const ACTIVE_RUN_KEY = 'ls_active_run';
const pendingKey = (runId: string) => `ls_run_pending_${runId}`;

interface PendingCheckin { index: number; ll: LatLng; t: number; accuracy: number }
interface WakeLockLike { released: boolean; release(): Promise<void>; addEventListener(type: 'release', listener: () => void): void }
type WakeNavigator = Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> } };

export interface PushItem { title: string; type: string; status: string; desc: string; voice: string; contentTypeId: number; firstImage: string | null; source: 'COURSE' | 'TOURAPI' | 'SEED'; reward?: boolean }
export interface EngineState {
  status: 'idle' | 'recovering' | 'starting' | 'running' | 'paused' | 'finishing' | 'finished' | 'error';
  runId: string | null; progress: number; elapsedSec: number; runner: LatLng | null; done: LatLng[]; nextCp: number; checkedIn: Set<number>;
  push: PushItem | null; pois: Poi[]; log: LogEntry[]; nearbySource: NearbyResult['source'] | null; nearbyMs: number | null; lastRaw: unknown; gpsNote: string | null; gpsAccuracyM: number | null; gpsInterrupted: boolean; offline: boolean; pendingPoints: number; pendingCheckins: number; wakeLockActive: boolean; recovered: boolean; error: string | null;
}

export function useRunEngine(course: Course | null, mode: Mode, speed: number) {
  const [s, setS] = useState<EngineState>({ status: 'idle', runId: null, progress: 0, elapsedSec: 0, runner: null, done: [], nextCp: 1, checkedIn: new Set([0]), push: null, pois: [], log: [], nearbySource: null, nearbyMs: null, lastRaw: null, gpsNote: null, gpsAccuracyM: null, gpsInterrupted: false, offline: typeof navigator !== 'undefined' ? !navigator.onLine : false, pendingPoints: 0, pendingCheckins: 0, wakeLockActive: false, recovered: false, error: null });
  const r = useRef({ progress: 0, nextCp: 1, seen: new Set<string>(), raf: 0, lastTs: 0, paused: false, runId: '' as string, cps: [] as Course['checkpoints'], pois: [] as CoursePoi[], route: [] as LatLng[], cum: [] as number[], total: 0, lastQueryAt: -1e9, trackBuf: [] as RunTrackPoint[], pendingCheckins: [] as PendingCheckin[], lastTrackSent: 0, flushPromise: null as Promise<void> | null, syncPromise: null as Promise<void> | null, watch: null as number | null, lastFix: null as LatLng | null, lastFixAt: 0, elapsed: 0, startedAt: 0, pushTimer: 0, monitorTimer: 0, reconnectTimer: 0, wakeLock: null as WakeLockLike | null, speed, mode, finishing: false, checkinPending: false, log: [] as LogEntry[] });
  r.current.speed = speed; r.current.mode = mode;

  const clock = () => (r.current.mode === 'DEMO' ? fmtTime((r.current.progress / 1000) * PACE_SEC) : fmtTime(r.current.elapsed));
  const log = useCallback((kind: LogKind, text: string) => { r.current.log = [{ t: clock(), kind, text }, ...r.current.log].slice(0, 30); setS((p) => ({ ...p, log: r.current.log })); }, []);
  const setPush = (push: PushItem | null) => { setS((p) => ({ ...p, push })); clearTimeout(r.current.pushTimer); if (push) r.current.pushTimer = window.setTimeout(() => setS((p) => ({ ...p, push: null })), 7000 / r.current.speed); };

  const persistPending = () => {
    const c = r.current;
    if (!c.runId) return;
    try {
      if (c.trackBuf.length || c.pendingCheckins.length) {
        localStorage.setItem(pendingKey(c.runId), JSON.stringify({ points: c.trackBuf.slice(-10000), checkins: c.pendingCheckins }));
      } else {
        localStorage.removeItem(pendingKey(c.runId));
      }
      setS((p) => ({ ...p, pendingPoints: c.trackBuf.length, pendingCheckins: c.pendingCheckins.length }));
    } catch { /* 저장 공간이 부족해도 메모리 큐는 유지 */ }
  };

  const restorePending = (runId: string) => {
    try {
      const raw = localStorage.getItem(pendingKey(runId));
      if (!raw) return;
      const saved = JSON.parse(raw) as { points?: RunTrackPoint[]; checkins?: PendingCheckin[] };
      r.current.trackBuf = Array.isArray(saved.points) ? saved.points.slice(-10000) : [];
      r.current.pendingCheckins = Array.isArray(saved.checkins) ? saved.checkins : [];
    } catch { localStorage.removeItem(pendingKey(runId)); }
  };

  const rememberActiveRun = (runId: string, courseSlug: string) => {
    try { localStorage.setItem(ACTIVE_RUN_KEY, JSON.stringify({ runId, courseSlug, savedAt: Date.now() })); } catch { /* 서버 복구가 기본 경로 */ }
  };

  const forgetActiveRun = () => {
    const runId = r.current.runId;
    try {
      localStorage.removeItem(ACTIVE_RUN_KEY);
      if (runId) localStorage.removeItem(pendingKey(runId));
    } catch { /* noop */ }
  };

  const releaseWakeLock = useCallback(async () => {
    const lock = r.current.wakeLock;
    r.current.wakeLock = null;
    try { if (lock && !lock.released) await lock.release(); } catch { /* 브라우저가 이미 해제함 */ }
    setS((p) => ({ ...p, wakeLockActive: false }));
  }, []);

  const acquireWakeLock = useCallback(async () => {
    const c = r.current;
    const wake = (navigator as WakeNavigator).wakeLock;
    if (!wake || !c.runId || c.paused || c.finishing || document.visibilityState !== 'visible' || (c.wakeLock && !c.wakeLock.released)) return;
    try {
      const lock = await wake.request('screen');
      if (!c.runId || c.paused || c.finishing) { await lock.release(); return; }
      c.wakeLock = lock;
      setS((p) => ({ ...p, wakeLockActive: true }));
      lock.addEventListener('release', () => {
        if (r.current.wakeLock === lock) r.current.wakeLock = null;
        setS((p) => ({ ...p, wakeLockActive: false }));
      });
    } catch { setS((p) => ({ ...p, wakeLockActive: false })); }
  }, []);

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

  const markCheckpointLocal = (i: number) => {
    r.current.nextCp = Math.max(r.current.nextCp, i + 1);
    setS((p) => {
      const checkedIn = new Set(p.checkedIn); checkedIn.add(i);
      return { ...p, nextCp: Math.max(p.nextCp, i + 1), checkedIn };
    });
  };

  const queueCheckin = (item: PendingCheckin) => {
    if (!r.current.pendingCheckins.some((x) => x.index === item.index)) r.current.pendingCheckins.push(item);
    markCheckpointLocal(item.index);
    persistPending();
  };

  const checkinServer = async (i: number, ll: LatLng, method: 'DEMO' | 'GPS', t = Date.now(), accuracy = 0) => {
    if (r.current.checkinPending) return false;
    r.current.checkinPending = true;
    const cp = r.current.cps![i];
    try {
      if (method === 'GPS') await flushTrack(true);
      await api.post(`/runs/${r.current.runId}/checkin`, { checkpointId: cp.id, lat: ll[0], lng: ll[1], t, accuracy, method });
      markCheckpointLocal(i);
      if (i < r.current.cps!.length - 1) { log('sense', `체크포인트 ${i} '${cp.name}' ${cp.radiusM}m 반경 진입`); log('act', `GPS 궤적 확인 · 자동 체크인 저장 · 미션 ${i + 1}/${r.current.cps!.length}${cp.reward ? ' · 리워드 대상 구간' : ''}`); }
      else setS((p) => ({ ...p, gpsNote: '모든 체크포인트를 통과했습니다 · 완주 버튼을 눌러 인증해 주세요' }));
      return true;
    } catch (e: any) {
      const retryable = !navigator.onLine || r.current.trackBuf.length > 0 || !(e instanceof ApiError) || e.status >= 500;
      if (method === 'GPS' && retryable) {
        queueCheckin({ index: i, ll, t, accuracy });
        log('act', `체크포인트 '${cp.name}' 인증을 기기에 보관 · 연결되면 자동 전송`);
        if (i >= r.current.cps!.length - 1) setS((p) => ({ ...p, gpsNote: '마지막 체크포인트 기록을 보관했습니다 · 연결 후 완주 인증이 가능합니다' }));
        return true;
      }
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
    if (!navigator.onLine) {
      persistPending();
      setS((p) => ({ ...p, offline: true, gpsNote: `오프라인 · GPS 기록 ${r.current.trackBuf.length}개를 기기에 보관 중` }));
      return;
    }
    r.current.lastTrackSent = now;
    const task = (async () => {
      do {
        const pts = r.current.trackBuf.splice(0, 500);
        if (!pts.length) break;
        persistPending();
        try {
          const saved = await api.post<{ distanceM: number; points: number }>(`/runs/${r.current.runId}/track`, { points: pts });
          r.current.progress = saved.distanceM;
          setS((p) => ({ ...p, progress: saved.distanceM, offline: false, pendingPoints: r.current.trackBuf.length }));
        } catch {
          r.current.trackBuf = [...pts, ...r.current.trackBuf].slice(-10000);
          persistPending();
          setS((p) => ({ ...p, offline: !navigator.onLine, gpsNote: `GPS 기록 ${r.current.trackBuf.length}개 전송 대기 중` }));
          break;
        }
      } while (force && r.current.trackBuf.length && navigator.onLine);
      r.current.flushPromise = null;
      persistPending();
    })();
    r.current.flushPromise = task;
    await task;
  };

  const syncPending = async () => {
    const c = r.current;
    if (c.syncPromise) return c.syncPromise;
    if (!c.runId || !navigator.onLine) return;
    const task = (async () => {
      try {
        await flushTrack(true);
        if (c.trackBuf.length) return;
        while (c.pendingCheckins.length && navigator.onLine) {
          const item = c.pendingCheckins[0];
          const cp = c.cps![item.index];
          try {
            await api.post(`/runs/${c.runId}/checkin`, { checkpointId: cp.id, lat: item.ll[0], lng: item.ll[1], t: item.t, accuracy: item.accuracy, method: 'GPS' });
            c.pendingCheckins.shift();
            persistPending();
            log('act', `보관했던 체크포인트 '${cp.name}' 인증 전송 완료`);
          } catch (e: any) {
            setS((p) => ({ ...p, gpsNote: `체크포인트 인증 ${c.pendingCheckins.length}건 전송 대기 · ${e.message}` }));
            break;
          }
        }
      } finally {
        persistPending();
      }
    })();
    c.syncPromise = task;
    try { await task; } finally { c.syncPromise = null; }
  };

  const finish = useCallback(async () => {
    if (r.current.finishing || !r.current.runId) return null;
    r.current.finishing = true;
    setS((p) => ({ ...p, status: 'finishing' }));
    await syncPending();
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
      if (r.current.watch != null) { navigator.geolocation.clearWatch(r.current.watch); r.current.watch = null; }
      clearInterval(r.current.monitorTimer);
      clearTimeout(r.current.reconnectTimer);
      forgetActiveRun();
      await releaseWakeLock();
      setS((p) => ({ ...p, status: 'finished' }));
      return summary;
    } catch (e: any) {
      setS((p) => ({ ...p, status: 'running', error: e.message, gpsNote: e.message }));
      r.current.finishing = false;
      void acquireWakeLock();
      return null;
    }
  }, [acquireWakeLock, course, log, releaseWakeLock]);

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
    if (c.trackBuf.length > 10000) c.trackBuf.splice(0, c.trackBuf.length - 10000);
    persistPending();
    const toStart = haversine(ll, c.route[0]);
    const note = toStart > 1500 ? `코스 출발점에서 ${(toStart / 1000).toFixed(1)}km 떨어져 있습니다` : `GPS 연결됨 · 정확도 ±${accuracy}m`;
    setS((p) => ({ ...p, progress: c.progress, elapsedSec: c.elapsed, runner: ll, done: [...p.done, ll].slice(-2000), gpsNote: note, gpsAccuracyM: accuracy, gpsInterrupted: false, offline: !navigator.onLine, pendingPoints: c.trackBuf.length }));
    const nx = c.cps![c.nextCp];
    if (nx && !c.checkinPending && haversine(ll, [nx.lat, nx.lng]) <= nx.radiusM + Math.min(accuracy, 30)) {
      const i = c.nextCp;
      void checkinServer(i, ll, 'GPS', fixAt, accuracy);
    }
    void checkDiscovery(ll, c.progress);
    void flushTrack().then(() => { if (c.pendingCheckins.length) void syncPending(); });
  };

  const startMonitor = () => {
    clearInterval(r.current.monitorTimer);
    r.current.monitorTimer = window.setInterval(() => {
      const c = r.current;
      if (!c.runId || c.finishing) return;
      c.elapsed = Math.max(0, (Date.now() - c.startedAt) / 1000);
      const staleSec = c.lastFixAt ? Math.floor((Date.now() - c.lastFixAt) / 1000) : 0;
      const interrupted = !c.paused && staleSec >= 20;
      setS((p) => ({
        ...p,
        elapsedSec: c.elapsed,
        gpsInterrupted: interrupted,
        gpsNote: interrupted ? `GPS 신호가 ${staleSec}초 동안 없습니다 · 위치 서비스와 하늘이 보이는 환경을 확인해 주세요` : p.gpsNote,
      }));
    }, 1000);
  };

  const startGpsWatch = (manual = false) => {
    const c = r.current;
    clearTimeout(c.reconnectTimer);
    if (!c.runId || c.mode !== 'LIVE' || !('geolocation' in navigator)) return;
    if (c.watch != null) navigator.geolocation.clearWatch(c.watch);
    if (manual) setS((p) => ({ ...p, gpsNote: 'GPS를 다시 연결하는 중…', gpsInterrupted: true }));
    c.watch = navigator.geolocation.watchPosition(onFix, (err) => {
      setS((p) => ({ ...p, gpsInterrupted: true, gpsNote: `GPS 위치를 받을 수 없습니다 (${err.message})` }));
      if (err.code !== 1) { clearTimeout(c.reconnectTimer); c.reconnectTimer = window.setTimeout(() => startGpsWatch(), 5000); }
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
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
      c.progress = 0; c.nextCp = 1; c.seen = new Set(); c.lastQueryAt = -1e9; c.startedAt = new Date(run.startedAt).getTime(); c.finishing = false; c.paused = false; c.checkinPending = false; c.trackBuf = []; c.pendingCheckins = []; c.log = [];
      const initialLl: LatLng = initialFix ? [initialFix.lat, initialFix.lng] : c.route[0];
      c.lastFix = initialLl; c.lastFixAt = initialFix?.t ?? Date.now();
      rememberActiveRun(run.id, full.slug);
      setS((p) => ({ ...p, status: 'running', runId: run.id, progress: 0, elapsedSec: 0, runner: initialLl, done: [], nextCp: 1, checkedIn: new Set([0]), pois: [], push: null, gpsAccuracyM: initialFix ? Math.round(initialFix.accuracy) : null, gpsNote: initialFix ? `출발점 GPS 인증 완료 · 정확도 ±${Math.round(initialFix.accuracy)}m` : null, gpsInterrupted: false, offline: !navigator.onLine, pendingPoints: 0, pendingCheckins: 0, recovered: false, error: null }));
      log('sense', `실제 GPS 출발 인증 · (${initialLl[0].toFixed(4)}, ${initialLl[1].toFixed(4)}) · 정확도 ±${Math.round(initialFix?.accuracy ?? 0)}m · 코스 ${(c.total / 1000).toFixed(1)}km`);
      log('decide', `코스 컨텍스트 로드 — 체크포인트 ${c.cps.length}곳 · 코스 등록 장소 ${c.pois.length}곳 · TourAPI 반경 500m 실시간 조회 · 음성 ${voiceOn() ? '켬' : '끔'}`);
      speak(`${course.name}을 시작합니다. 가볍게 출발하세요.`);
      startMonitor();
      void acquireWakeLock();
      if (mode === 'DEMO') { c.lastTs = performance.now(); c.raf = requestAnimationFrame(tick); }
      else if ('geolocation' in navigator) startGpsWatch();
      else setS((p) => ({ ...p, gpsNote: '이 기기는 위치 정보를 지원하지 않아요' }));
    } catch (e: any) { setS((p) => ({ ...p, status: 'error', error: e.message, gpsNote: null })); }
  }, [acquireWakeLock, course, mode, log]);

  useEffect(() => {
    if (!course || r.current.runId) return;
    let cancelled = false;
    setS((p) => ({ ...p, status: 'recovering', error: null, gpsNote: '진행 중인 러닝을 확인하는 중…' }));
    void api.get<ActiveRun | null>(`/runs/active?courseId=${encodeURIComponent(course.id)}`).then((active) => {
      if (cancelled) return;
      if (!active) {
        setS((p) => ({ ...p, status: 'idle', gpsNote: null }));
        return;
      }
      const c = r.current;
      const full = active.course;
      const serverTrack = Array.isArray(active.track) ? active.track : [];
      c.runId = active.id; c.cps = full.checkpoints ?? []; c.pois = full.pois ?? []; c.route = full.polyline; c.cum = cumulative(full.polyline); c.total = c.cum[c.cum.length - 1];
      c.progress = active.distanceM; c.seen = new Set(); c.lastQueryAt = -1e9; c.startedAt = new Date(active.startedAt).getTime(); c.elapsed = Math.max(0, (Date.now() - c.startedAt) / 1000); c.finishing = false; c.paused = false; c.checkinPending = false; c.log = [];
      restorePending(active.id);
      const serverCheckedIds = new Set(active.checkins.map((x) => x.checkpointId));
      c.pendingCheckins = c.pendingCheckins.filter((x) => !serverCheckedIds.has(c.cps![x.index]?.id));
      const checkedIn = new Set<number>();
      c.cps!.forEach((cp, i) => { if (serverCheckedIds.has(cp.id)) checkedIn.add(i); });
      c.pendingCheckins.forEach((x) => checkedIn.add(x.index));
      const next = c.cps!.findIndex((_, i) => !checkedIn.has(i));
      c.nextCp = next < 0 ? c.cps!.length : next;
      const latest = c.trackBuf[c.trackBuf.length - 1] ?? serverTrack[serverTrack.length - 1];
      const initialLl: LatLng = latest ? [latest.lat, latest.lng] : c.route[0];
      c.lastFix = initialLl; c.lastFixAt = latest?.t ?? Date.now();
      const done = [...serverTrack, ...c.trackBuf].map((p) => [p.lat, p.lng] as LatLng).slice(-2000);
      rememberActiveRun(active.id, full.slug);
      persistPending();
      setS((p) => ({ ...p, status: 'running', runId: active.id, progress: active.distanceM, elapsedSec: c.elapsed, runner: initialLl, done, nextCp: c.nextCp, checkedIn, pois: [], push: null, gpsAccuracyM: latest?.accuracy != null ? Math.round(latest.accuracy) : null, gpsNote: `진행 중이던 러닝을 복구했습니다 · GPS 기록 ${c.trackBuf.length}개 전송 대기`, gpsInterrupted: false, offline: !navigator.onLine, pendingPoints: c.trackBuf.length, pendingCheckins: c.pendingCheckins.length, recovered: true, error: null }));
      log('act', `진행 중 러닝 복구 · ${(active.distanceM / 1000).toFixed(2)}km · 체크포인트 ${checkedIn.size}/${c.cps!.length}`);
      startMonitor();
      startGpsWatch();
      void acquireWakeLock();
      void syncPending();
    }).catch((e: any) => {
      if (!cancelled) setS((p) => ({ ...p, status: 'idle', gpsNote: null, error: `러닝 복구 확인 실패: ${e.message}` }));
    });
    return () => { cancelled = true; };
  }, [acquireWakeLock, course, log]);

  const togglePause = useCallback(() => {
    const c = r.current; if (!c.runId || c.finishing) return;
    c.paused = !c.paused;
    setS((p) => ({ ...p, status: c.paused ? 'paused' : 'running' }));
    if (c.paused) void releaseWakeLock();
    else void acquireWakeLock();
    if (!c.paused && c.mode === 'DEMO') { c.lastTs = performance.now(); c.raf = requestAnimationFrame(tick); }
  }, [acquireWakeLock, releaseWakeLock]);

  const nextCheckpoint = useCallback(() => {
    const c = r.current; if (!c.runId || c.mode !== 'DEMO' || c.finishing) return;
    if (c.nextCp >= c.cps!.length - 1) { void finish(); return; }
    c.progress = c.cps![c.nextCp].distM; const i = c.nextCp; c.nextCp = i + 1;
    void checkinServer(i, [c.cps![i].lat, c.cps![i].lng], 'DEMO');
    setS((p) => ({ ...p, progress: c.progress, runner: pointAt(c.route, c.cum, c.progress), done: sliceTo(c.route, c.cum, c.progress) }));
    c.lastTs = performance.now();
  }, [finish]);

  useEffect(() => {
    const onOnline = () => { setS((p) => ({ ...p, offline: false, gpsNote: p.gpsInterrupted ? p.gpsNote : '네트워크 연결 복구 · 저장한 GPS 기록을 전송하는 중…' })); void syncPending(); };
    const onOffline = () => { persistPending(); setS((p) => ({ ...p, offline: true, gpsNote: '오프라인 · GPS 기록은 이 기기에 계속 보관됩니다' })); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'visible') void acquireWakeLock(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [acquireWakeLock]);

  useEffect(() => () => {
    persistPending();
    cancelAnimationFrame(r.current.raf);
    if (r.current.watch != null) navigator.geolocation.clearWatch(r.current.watch);
    clearTimeout(r.current.pushTimer);
    clearTimeout(r.current.reconnectTimer);
    clearInterval(r.current.monitorTimer);
    const lock = r.current.wakeLock;
    r.current.wakeLock = null;
    if (lock && !lock.released) void lock.release();
  }, []);

  const total = r.current.total || course?.distanceM || 0;
  return { s, start, togglePause, finish, nextCheckpoint, total, reconnectGps: () => startGpsWatch(true), closePush: () => setPush(null), log };
}
