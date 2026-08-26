'use client';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { fmtPace } from '@/lib/types';

interface Post { id: string; type: 'PACEMAKER' | 'MATE'; paceSec: number; meetAt: string; place: string; slots: number; body: string; applied: boolean; isMine: boolean; author: { nickname: string; avatarColor: string }; _count: { applications: number } }
export default function MatesPage() {
  const [type, setType] = useState<'' | 'PACEMAKER' | 'MATE'>('');
  const [items, setItems] = useState<Post[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ type: 'MATE' as 'MATE' | 'PACEMAKER', pace: 6.5, meetAt: '', place: '수성못 수변 데크', slots: 4, body: '' });
  const [msg, setMsg] = useState('');
  const load = () => api.get<{ items: Post[] }>(`/mates${type ? `?type=${type}` : ''}`).then((r) => setItems(r.items)).catch(() => null);
  useEffect(() => { load(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = async (p: Post) => { try { await api.post(`/mates/${p.id}/apply`); setMsg('신청 완료 — 닉네임으로만 공개됩니다'); await load(); } catch (e: any) { setMsg(e.message); } };
  const create = async () => { try { await api.post('/mates', { type: f.type, paceSec: Math.round(f.pace * 60), meetAt: new Date(f.meetAt).toISOString(), place: f.place, slots: f.slots, body: f.body }); setOpen(false); await load(); } catch (e: any) { setMsg(e.message); } };
  return (
    <main className="page">
      <AppHeader back title="러닝 메이트" right={<button className="btn sm" type="button" onClick={() => setOpen((v) => !v)}>{open ? '닫기' : '+ 모집'}</button>} />
      <div className="pills" style={{ marginBottom: 12 }}>{([['', '전체'], ['PACEMAKER', '페이스메이커'], ['MATE', '러닝 메이트']] as const).map(([v, l]) => <button key={v} type="button" className={`pill ${type === v ? 'on' : ''}`} onClick={() => setType(v)}>{l}</button>)}</div>
      {open && <div className="card stack" style={{ marginBottom: 12 }}>
        <div className="pills"><button type="button" className={`pill ${f.type === 'MATE' ? 'on' : ''}`} onClick={() => setF({ ...f, type: 'MATE' })}>러닝 메이트</button><button type="button" className={`pill ${f.type === 'PACEMAKER' ? 'on' : ''}`} onClick={() => setF({ ...f, type: 'PACEMAKER' })}>페이스메이커 모집</button></div>
        <div className="two"><label className="field">페이스 (분/km)<input className="input" type="number" step={0.5} min={3} max={15} value={f.pace} onChange={(e) => setF({ ...f, pace: Number(e.target.value) })} /></label><label className="field">모집 인원<input className="input" type="number" min={1} max={30} value={f.slots} onChange={(e) => setF({ ...f, slots: Number(e.target.value) })} /></label></div>
        <label className="field">일시<input className="input" type="datetime-local" value={f.meetAt} onChange={(e) => setF({ ...f, meetAt: e.target.value })} /></label>
        <label className="field">집결 장소<input className="input" value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} /></label>
        <label className="field">한마디<input className="input" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="예: 블루런 5K 6분 페이스로 같이 달려요" /></label>
        <button className="btn" type="button" disabled={!f.meetAt || f.place.length < 2} onClick={create}>올리기</button>
      </div>}
      {msg && <div className="note" style={{ marginBottom: 8 }}>{msg}</div>}
      <div className="stack">{items.map((p) => (
        <div key={p.id} className="list-item">
          <span className="av ic" style={{ background: p.author.avatarColor, color: '#fff' }}>{p.author.nickname.slice(0, 1)}</span>
          <div><h4><span className={`tag ${p.type === 'PACEMAKER' ? 'gold' : ''}`}>{p.type === 'PACEMAKER' ? '페이스메이커' : '메이트'}</span> {fmtPace(p.paceSec)} · {p.place}</h4><p>{new Date(p.meetAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · {p._count.applications}/{p.slots}명 · {p.author.nickname}{p.body ? ` · ${p.body}` : ''}</p></div>
          <button className={`go ${p.applied ? 'on' : ''}`} type="button" disabled={p.applied || p.isMine} onClick={() => apply(p)}>{p.isMine ? '내 글' : p.applied ? '신청됨' : '신청'}</button>
        </div>
      ))}{items.length === 0 && <div className="empty">모집 글이 없어요</div>}</div>
      <p className="note">월별 러닝 메이트 자동 매칭(페이스·지역·시간대)은 2단계에서 TEAMPL 매칭 로직을 재활용합니다.</p>
    </main>
  );
}
