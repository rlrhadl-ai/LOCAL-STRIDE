'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import AgentLog from '@/components/AgentLog';
import LiveBadge from '@/components/LiveBadge';
import { api } from '@/lib/api';
import { setVoice, speak, voiceOn } from '@/lib/speech';
import { useRunEngine } from '@/lib/useRunEngine';
import { fmtKm, fmtPace, fmtTime, type Course } from '@/lib/types';

const RunMap = dynamic(() => import('@/components/RunMap'), { ssr: false });

export default function RunPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [voice, setV] = useState(true);
  const [question, setQ] = useState('');
  const [asking, setAsking] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const { s, start, togglePause, finish, closePush, log } = useRunEngine(course, 'LIVE', 1);

  useEffect(() => { api.get<Course>(`/courses/${courseId}`).then(setCourse).catch(() => setCourse(null)); }, [courseId]);
  useEffect(() => { if (s.status === 'finished' && s.runId) router.push(`/finish/${s.runId}`); }, [s.status, s.runId, router]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === ' ') { e.preventDefault(); ['idle', 'error'].includes(s.status) ? begin() : togglePause(); }
      else if (e.key === 'f' || e.key === 'F') void finish();
      else if (e.key === 'm' || e.key === 'M') toggleVoice();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const begin = () => { if (s.status === 'starting' || s.status === 'running') return; void start(); };
  const toggleVoice = () => { const v = !voiceOn(); setVoice(v); setV(v); };
  const cps = course?.checkpoints ?? [];
  const nextCp = cps[Math.min(s.nextCp, cps.length - 1)];
  const nextDist = nextCp ? Math.max(0, Math.round(s.runner ? haversineM(s.runner, [nextCp.lat, nextCp.lng]) : nextCp.distM)) : 0;
  const cpState = useMemo(() => (i: number) => (s.checkedIn.has(i) ? 'done' : i === s.nextCp ? 'next' : ''), [s.checkedIn, s.nextCp]);
  const pace = s.progress > 50 ? fmtPace(s.elapsedSec / (s.progress / 1000)) : "--'--\"";

  const ask = async () => {
    if (!question.trim() || !s.runner) return;
    setAsking(true);
    try {
      const r = await api.post<{ answer: string; source: string; latencyMs: number; context: { source: string; pois: { title: string; dist: number }[] } }>('/ai/ask', { question, lat: s.runner[0], lng: s.runner[1], courseName: course?.name, distanceM: Math.round(s.progress) });
      log('decide', `AI 동반자(${r.source}) ${r.latencyMs}ms · 컨텍스트 ${r.context.source} ${r.context.pois.length}곳 → "${r.answer.slice(0, 60)}${r.answer.length > 60 ? '…' : ''}"`);
      speak(r.answer, true); setQ('');
    } catch (e: any) { log('sense', `AI 응답 실패: ${e.message}`); }
    finally { setAsking(false); }
  };

  if (!course) return <main className="page no-tab"><div className="empty">코스를 불러오는 중…</div></main>;
  const running = s.status === 'running' || s.status === 'paused';
  return (
    <main className="run-shell">
      <div className="stats">
        <div><b>{fmtKm(s.progress)}</b><span>km</span></div>
        <div><b>{fmtTime(s.elapsedSec)}</b><span>시간</span></div>
        <div><b>{pace}</b><span>페이스</span></div>
      </div>
      <div className="map-wrap">
        <RunMap route={course.polyline} done={s.done} checkpoints={cps} cpState={cpState} runner={s.runner ?? course.polyline[0]} pois={s.pois} follow />
        <div className="map-chip">
          <span className="live-badge"><i />실제 GPS{s.gpsAccuracyM != null ? ` ±${s.gpsAccuracyM}m` : ''}</span>
          {s.nearbySource && <button type="button" style={{ all: 'unset', cursor: 'pointer' }} onClick={() => setShowRaw((v) => !v)}><LiveBadge source={s.nearbySource} ms={s.nearbyMs ?? undefined} label="TourAPI" /></button>}
        </div>
        {s.push && (
          <div className="push show">
            <div className="ph">{s.push.firstImage ? <img src={s.push.firstImage} alt="" /> : s.push.type.slice(0, 1)}</div>
            <div>
              <div className="kind">500m 내 추천 장소 · {s.push.type}{s.push.source === 'TOURAPI' ? ' · LIVE' : ''}</div>
              <h4>{s.push.title}</h4>
              <div className="status">{s.push.status}</div>
              <p>{s.push.desc}</p>
              <div className="acts"><button className="main" type="button" onClick={() => speak(s.push!.voice, true)}>음성 가이드 듣기</button><button type="button" onClick={() => { log('learn', `관심 장소 저장 → '${s.push!.type}' 가중치 +1`); closePush(); }}>관심 장소 저장</button></div>
            </div>
            <button className="x" type="button" aria-label="닫기" onClick={closePush}>×</button>
          </div>
        )}
        {s.gpsNote && <div className="gps-banner"><span>{s.gpsNote}</span><button type="button" onClick={() => location.reload()}>다시 시작</button></div>}
        {showRaw && s.lastRaw != null && <div className="data-panel" style={{ position: 'absolute', zIndex: 760, left: 10, right: 10, bottom: 10 }}>{JSON.stringify(s.lastRaw, null, 1).slice(0, 900)}</div>}
      </div>
      <div className="run-bottom">
        <div className="next-card">
          <div className="row"><div><div className="lbl">{s.nextCp >= cps.length - 1 ? '피니시까지' : '다음 체크포인트까지'}</div><div className="name">{nextCp?.name ?? '-'}</div></div><div className="dist">{nextDist.toLocaleString('ko-KR')}m</div></div>
          <div className="cps">{cps.map((_, i) => <i key={i} className={cpState(i)} />)}</div>
          {s.status === 'idle' || s.status === 'starting' || s.status === 'error' ? (
            <div className="stack">
              {s.error && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{s.error}</div>}
              <button className="btn" type="button" disabled={s.status === 'starting'} onClick={begin}>{s.status === 'starting' ? 'GPS 확인 중…' : `GPS 확인 후 ${course.name} 시작`}</button>
              <p className="note" style={{ marginTop: 0 }}>코스 출발점에서 위치 권한을 허용해 주세요. 정확도 80m 이내의 실제 GPS만 기록하며, 모든 체크포인트와 코스 거리의 80% 이상이 서버에서 확인되어야 완주됩니다.</p>
            </div>
          ) : (
            <div className="run-ctl">
              <button className={`round voice ${voice ? 'on' : ''}`} type="button" aria-pressed={voice} aria-label="음성 가이드" onClick={toggleVoice}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg></button>
              <button className="big" type="button" aria-label={s.status === 'paused' ? '재개' : '일시정지'} onClick={togglePause}>{s.status === 'paused' ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l11-7z" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>}</button>
              <button className="round stop" type="button" aria-label="완주 확인" onClick={() => void finish()}><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg></button>
            </div>
          )}
        </div>
      </div>
      <AgentLog entries={s.log}>
        {running && <div className="ask-row"><input value={question} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} placeholder="AI 동반자에게 물어보기 — 이 근처 뭐 있어?" /><button type="button" disabled={asking} onClick={ask}>{asking ? '…' : '질문'}</button></div>}
      </AgentLog>
    </main>
  );
}

function haversineM(a: [number, number], b: [number, number]) { const R = 6371000, r = (d: number) => (d * Math.PI) / 180; const dLat = r(b[0] - a[0]), dLng = r(b[1] - a[1]); const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)); }
