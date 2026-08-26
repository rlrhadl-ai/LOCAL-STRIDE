'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { fmtPace } from '@/lib/types';

interface Crew { id: string; name: string; description: string; lifestyle: string[]; paceMinSec: number; paceMaxSec: number; area: string; openChatUrl: string | null; joined: boolean; owner: { nickname: string; avatarColor: string }; members: { user: { id: string; nickname: string; avatarColor: string }; role: string }[]; runs: { id: string; startsAt: string; note: string | null; course: { slug: string; name: string; distanceM: number } | null }[] }
export default function CrewDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Crew | null>(null);
  const [msg, setMsg] = useState('');
  const load = () => api.get<Crew>(`/crews/${id}`).then(setC).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = async () => { try { await api.post(`/crews/${id}/${c?.joined ? 'leave' : 'join'}`); await load(); } catch (e: any) { setMsg(e.message); } };
  const addRun = async () => { const d = new Date(Date.now() + 2 * 86400000); d.setHours(6, 30, 0, 0); try { await api.post(`/crews/${id}/runs`, { courseId: c?.runs[0]?.course ? undefined : undefined, startsAt: d.toISOString(), note: '정기 러닝' }); await load(); } catch (e: any) { setMsg(e.message); } };
  if (!c) return <main className="page"><AppHeader back title="크루" /><div className="empty">{msg || '불러오는 중…'}</div></main>;
  return (
    <main className="page">
      <AppHeader back title={c.name} />
      <div className="profile"><div className="who"><div className="avatar" style={{ color: c.owner.avatarColor }}>{c.name.slice(0, 1)}</div><div><h3>{c.name}</h3><div className="lv">{c.area} · {c.lifestyle.join(' · ')} · {fmtPace(c.paceMinSec)}~{fmtPace(c.paceMaxSec)}</div></div></div><div className="prow"><div><b>{c.members.length}</b><span>멤버</span></div><div><b>{c.runs.length}</b><span>일정</span></div><div><b>{c.owner.nickname}</b><span>크루장</span></div></div></div>
      <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: '12px 0' }}>{c.description}</p>
      <div className="two"><button className="btn" type="button" onClick={toggle} style={{ background: c.joined ? 'var(--muted)' : undefined }}>{c.joined ? '나가기' : '참여하기'}</button>{c.openChatUrl ? <a className="btn light" href={c.openChatUrl} target="_blank" rel="noreferrer">오픈채팅</a> : <button className="btn light" type="button" disabled>오픈채팅 미등록</button>}</div>
      {msg && <div className="note" style={{ color: 'var(--red)' }}>{msg}</div>}
      <div className="section-title"><h2>정기 러닝 일정</h2>{c.joined && <button type="button" className="pill" onClick={addRun}>+ 일정</button>}</div>
      <div className="stack">{c.runs.map((r) => <div key={r.id} className="list-item"><span className="ic">{new Date(r.startsAt).getDate()}</span><div><h4>{new Date(r.startsAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</h4><p>{r.course ? `${r.course.name} · ${(r.course.distanceM / 1000).toFixed(1)}km` : '코스 미정'}{r.note ? ` · ${r.note}` : ''}</p></div>{r.course && <a className="go" href={`/run/${r.course.slug}`}>달리기</a>}</div>)}{c.runs.length === 0 && <div className="empty">아직 일정이 없어요</div>}</div>
      <div className="section-title"><h2>멤버 {c.members.length}</h2><span>닉네임만 공개</span></div>
      <div className="pills">{c.members.map((m) => <span key={m.user.id} className="pill" style={{ borderColor: m.user.avatarColor }}>{m.user.nickname}{m.role === 'OWNER' ? ' ★' : ''}</span>)}</div>
    </main>
  );
}
