'use client';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';

interface Mission { id: string; code: string; type: string; title: string; description: string; periodEnd: string; rule: any; rewardText: string | null; progress: { value: number; done: boolean } }
interface Medal { code: string; name: string; description: string; earned: boolean }
interface Challenge { code: string; name: string; description: string; targetCount: number; completed: string[] }

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { api.get<{ items: Mission[] }>('/missions').then((r) => setMissions(r.items)).catch(() => null); api.get<{ medals: Medal[]; challenges: Challenge[] }>('/medals').then((r) => { setMedals(r.medals); setChallenges(r.challenges); }).catch(() => null); }, []);
  const target = (m: Mission) => m.type === 'PERIOD_DISTANCE' ? `${(m.progress.value / 1000).toFixed(1)} / ${(m.rule.targetM / 1000).toFixed(0)}km` : `${m.progress.value} / ${m.rule.count ?? 1}회`;
  const proof = (m: Mission) => { if (!('geolocation' in navigator)) return setMsg('위치 정보를 지원하지 않는 기기예요'); navigator.geolocation.getCurrentPosition((p) => api.post<{ merchant: string; distance: number }>(`/missions/${m.code}/proof`, { lat: p.coords.latitude, lng: p.coords.longitude }).then((r) => { setMsg(`${r.merchant} ${r.distance}m — 인증 완료`); }).catch((e) => setMsg(e.message)), () => setMsg('위치 권한이 필요해요 (https 필요)')); };
  return (
    <main className="page">
      <AppHeader back title="미션 · 메달" />
      {msg && <div className="card" style={{ fontSize: 13, marginBottom: 10 }}>{msg}</div>}
      <div className="section-title"><h2>이번 달 미션</h2><span>매월 갱신</span></div>
      <div className="stack">{missions.map((m) => (
        <div key={m.id} className={`mission ${m.progress.done ? 'done' : ''}`}>
          <span className="n">{m.progress.done ? '✓' : m.type === 'MIRACLE_RUN' ? '☀' : m.type === 'LOCAL_FOOD' ? '🍽' : '·'}</span>
          <div><h4>{m.title}</h4><p>{m.description} · {target(m)}{m.rewardText ? ` · 보상 ${m.rewardText}` : ''}</p></div>
          {m.type === 'LOCAL_FOOD' && !m.progress.done ? <button className="btn sm" type="button" onClick={() => proof(m)}>인증</button> : <span className="tag">{m.progress.done ? '완료' : '진행 중'}</span>}
        </div>
      ))}{missions.length === 0 && <div className="empty">진행 중인 미션이 없어요</div>}</div>
      {challenges.map((c) => <div key={c.code} className="card challenge" style={{ marginTop: 14 }}><div className="row"><h4>{c.name}</h4><span className="muted">{c.completed.length} / {c.targetCount}</span></div><div className="bar"><i style={{ width: `${(c.completed.length / c.targetCount) * 100}%` }} /></div><p>{c.description}</p></div>)}
      <div className="section-title"><h2>메달 컬렉션</h2><span>{medals.filter((m) => m.earned).length} / {medals.length}</span></div>
      <div className="stack">{medals.map((m) => <div key={m.code} className="list-item"><div className={`medal small ${m.earned ? '' : 'locked'}`}>{m.earned ? m.name.split(' ')[0] : '?'}</div><div><h4>{m.name}</h4><p>{m.description}</p></div><span className={`tag ${m.earned ? 'gold' : ''}`}>{m.earned ? '획득' : '미획득'}</span></div>)}</div>
    </main>
  );
}
