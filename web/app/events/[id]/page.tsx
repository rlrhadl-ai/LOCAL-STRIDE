'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import AppHeader from '@/components/AppHeader';
import { API_URL, api } from '@/lib/api';
import { fmtTime } from '@/lib/types';

interface Rank { rank: number; nickname: string; avatarColor: string; timeSec: number; distanceM: number }
interface Ev { id: string; title: string; description: string; startsAt: string; capacity: number; feeKrw: number; tshirt: boolean; status: string; course: { slug: string; name: string; distanceM: number } | null; registration: { bib: number | null; tshirtSize: string | null; paid: boolean } | null; ranking: Rank[]; _count: { registrations: number } }

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [ev, setEv] = useState<Ev | null>(null);
  const [ranking, setRanking] = useState<Rank[]>([]);
  const [size, setSize] = useState('L');
  const [live, setLive] = useState<'socket' | 'poll' | 'off'>('off');
  const [msg, setMsg] = useState('');
  const [board, setBoard] = useState(false);
  const sock = useRef<Socket | null>(null);

  const load = () => api.get<Ev>(`/events/${id}`).then((e) => { setEv(e); setRanking(e.ranking); }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ev) return;
    const s = io(`${API_URL}/live`, { transports: ['websocket', 'polling'] });
    sock.current = s;
    s.on('connect', () => { setLive('socket'); s.emit('join', ev.id); });
    s.on('ranking', (r: Rank[]) => setRanking(r));
    s.on('connect_error', () => setLive('poll'));
    const poll = setInterval(() => { if (sock.current?.connected) return; api.get<{ items: Rank[] }>(`/events/${ev.id}/ranking`).then((r) => setRanking(r.items)).catch(() => null); }, 5000);
    return () => { s.disconnect(); clearInterval(poll); };
  }, [ev?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const register = async () => { try { await api.post(`/events/${ev!.id}/register`, { tshirtSize: ev!.tshirt ? size : undefined }); setMsg('참가 등록 완료'); await load(); } catch (e: any) { setMsg(e.message); } };
  const submitResult = async () => { const t = prompt('기록 (분:초)', '18:30'); if (!t) return; const [m, s] = t.split(':').map(Number); try { await api.post(`/events/${ev!.id}/results`, { timeSec: m * 60 + (s || 0), distanceM: ev!.course?.distanceM ?? 3000 }); setMsg('기록이 라이브 랭킹에 반영되었어요'); } catch (e: any) { setMsg(e.message); } };

  if (!ev) return <main className="page"><AppHeader back title="대회" /><div className="empty">{msg || '불러오는 중…'}</div></main>;
  if (board) return (
    <main style={{ position: 'fixed', inset: 0, background: '#061A40', color: '#fff', padding: 24, overflow: 'auto', zIndex: 1000 }}>
      <div className="row"><div><div style={{ fontSize: 12, letterSpacing: '.2em', color: 'var(--gold)' }}>LIVE RANKING · {live === 'socket' ? 'SOCKET' : 'POLLING'}</div><h1 style={{ margin: '4px 0 0', fontSize: 'clamp(24px, 4vw, 48px)' }}>{ev.title}</h1></div><button className="btn sm light" type="button" onClick={() => setBoard(false)}>닫기</button></div>
      <div style={{ display: 'grid', gap: 8, marginTop: 20 }}>{ranking.map((r) => <div key={r.rank} style={{ display: 'grid', gridTemplateColumns: '64px 1fr auto', alignItems: 'center', gap: 16, padding: '12px 18px', borderRadius: 14, background: r.rank <= 3 ? 'rgba(228,178,58,.15)' : 'rgba(255,255,255,.05)', fontSize: 'clamp(16px, 2.6vw, 28px)', fontWeight: 800 }}><span style={{ color: r.rank <= 3 ? 'var(--gold)' : '#A9BBE3' }}>{r.rank}</span><span>{r.nickname}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(r.timeSec)}</span></div>)}{ranking.length === 0 && <div className="empty" style={{ color: '#A9BBE3' }}>기록이 들어오면 여기에 실시간으로 표시됩니다</div>}</div>
    </main>
  );
  return (
    <main className="page">
      <AppHeader back title="대회" />
      <div className="finish-hero"><div className="eyebrow">{ev.status === 'OPEN' ? 'OPEN' : ev.status} · {new Date(ev.startsAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric' })}</div><h2 style={{ fontSize: 24 }}>{ev.title}</h2><div className="sub">{ev.course ? `${ev.course.name} · ${(ev.course.distanceM / 1000).toFixed(1)}km` : ''} · {ev._count.registrations}/{ev.capacity}명 · {ev.feeKrw ? `${ev.feeKrw.toLocaleString()}원` : '무료'}</div><p style={{ fontSize: 13, color: '#C9D6F5', margin: '10px 0 0', lineHeight: 1.5 }}>{ev.description}</p></div>
      <div className="card" style={{ marginTop: 12 }}>
        {ev.registration ? <div className="row"><div><span className="tag green">참가 등록 완료</span><h4 style={{ margin: '6px 0 0' }}>배번 {ev.registration.bib ?? '-'} · 티셔츠 {ev.registration.tshirtSize ?? '-'}</h4></div><button className="btn sm" type="button" onClick={submitResult}>기록 입력</button></div>
          : <div className="stack">{ev.tshirt && <div className="field"><span>티셔츠 사이즈</span><div className="pills">{['S', 'M', 'L', 'XL', '2XL'].map((s) => <button key={s} type="button" className={`pill ${size === s ? 'on' : ''}`} onClick={() => setSize(s)}>{s}</button>)}</div></div>}<button className="btn" type="button" disabled={ev.status !== 'OPEN'} onClick={register}>참가 등록{ev.feeKrw ? ' (결제는 2단계)' : ''}</button></div>}
        {msg && <div className="note">{msg}</div>}
      </div>
      <div className="section-title"><h2>라이브 랭킹</h2><button type="button" className="pill" onClick={() => setBoard(true)}>전광판 열기</button></div>
      <div className="stack">{ranking.slice(0, 20).map((r) => <div key={r.rank} className="rank"><span className={`pos ${r.rank <= 3 ? 'top' : ''}`}>{r.rank}</span><span className="av" style={{ background: r.avatarColor }}>{r.nickname.slice(0, 1)}</span><span>{r.nickname}</span><b>{fmtTime(r.timeSec)}</b></div>)}{ranking.length === 0 && <div className="empty">아직 기록이 없어요</div>}</div>
      <p className="note">연결: {live === 'socket' ? 'Socket.IO 실시간' : live === 'poll' ? '5초 폴링 폴백' : '연결 중'} · 전광판은 프로젝터용 전체화면</p>
    </main>
  );
}
