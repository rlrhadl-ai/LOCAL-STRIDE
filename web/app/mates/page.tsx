'use client';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { fmtPace } from '@/lib/types';

interface Post { id: string; type: 'PACEMAKER' | 'MATE'; paceSec: number; meetAt: string; place: string; slots: number; body: string; applied: boolean; isMine: boolean; author: { nickname: string; avatarColor: string }; _count: { applications: number } }
const isPreview = (post: Post) => post.body.startsWith('[시범 모집]');
const cleanBody = (value: string) => value.replace(/^\[시범 모집\]\s*/, '');

export default function MatesPage() {
  const [type, setType] = useState<'' | 'PACEMAKER' | 'MATE'>('');
  const [items, setItems] = useState<Post[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'MATE' as 'MATE' | 'PACEMAKER', pace: 6.5, meetAt: '', place: '수성못 수변 데크', slots: 4, body: '' });
  const [message, setMessage] = useState('');
  const load = () => { setLoading(true); return api.get<{ items: Post[] }>(`/mates${type ? `?type=${type}` : ''}`).then((result) => setItems(result.items)).catch(() => setItems([])).finally(() => setLoading(false)); };
  useEffect(() => { load(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = async (post: Post) => { try { await api.post(`/mates/${post.id}/apply`); setMessage('신청 완료 — 닉네임으로만 공개됩니다.'); await load(); } catch (error: any) { setMessage(error.message); } };
  const create = async () => { try { await api.post('/mates', { type: form.type, paceSec: Math.round(form.pace * 60), meetAt: new Date(form.meetAt).toISOString(), place: form.place, slots: form.slots, body: form.body }); setOpen(false); await load(); } catch (error: any) { setMessage(error.message); } };

  return (
    <main className="page community-page">
      <AppHeader back title="러닝 메이트" right={<button className="btn sm" type="button" onClick={() => setOpen((value) => !value)}>{open ? '닫기' : '+ 모집'}</button>} />
      <section className="mate-hero"><span className="community-eyebrow">RUN TOGETHER, TODAY</span><h2>내 페이스와 시간에 맞는<br />대구 러너를 찾아보세요.</h2><p>가볍게 같이 달리거나, 목표 페이스를 이끌어 줄 러너를 모집해 보세요.</p></section>
      <div className="pills community-filters mate-filters">{([['', '전체'], ['PACEMAKER', '페이스메이커'], ['MATE', '러닝 메이트']] as const).map(([value, label]) => <button key={value} type="button" className={`pill ${type === value ? 'on' : ''}`} onClick={() => setType(value)}>{label}</button>)}</div>

      {open && <section className="card mate-form stack">
        <div className="row"><div><span className="community-eyebrow">NEW RUN</span><h3>함께 달릴 사람 모집</h3></div></div>
        <div className="pills"><button type="button" className={`pill ${form.type === 'MATE' ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 'MATE' })}>러닝 메이트</button><button type="button" className={`pill ${form.type === 'PACEMAKER' ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 'PACEMAKER' })}>페이스메이커</button></div>
        <div className="two"><label className="field">페이스 (분/km)<input className="input" type="number" step={0.5} min={3} max={15} value={form.pace} onChange={(event) => setForm({ ...form, pace: Number(event.target.value) })} /></label><label className="field">모집 인원<input className="input" type="number" min={1} max={30} value={form.slots} onChange={(event) => setForm({ ...form, slots: Number(event.target.value) })} /></label></div>
        <label className="field">일시<input className="input" type="datetime-local" value={form.meetAt} onChange={(event) => setForm({ ...form, meetAt: event.target.value })} /></label>
        <label className="field">집결 장소<input className="input" value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} /></label>
        <label className="field">한마디<input className="input" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="예: 블루런 5K를 6분 페이스로 같이 달려요" /></label>
        <button className="btn" type="button" disabled={!form.meetAt || form.place.length < 2} onClick={create}>모집 올리기</button>
      </section>}

      {message && <div className="note mate-message" aria-live="polite">{message}</div>}
      <div className="section-title community-title"><div><span className="community-eyebrow">OPEN RUNS</span><h2>러너 모집</h2></div><span>{items.length}개</span></div>
      <div className="mate-list">{items.map((post) => {
        const remaining = Math.max(0, post.slots - post._count.applications);
        return (
          <article key={post.id} className="mate-card">
            <div className="mate-author"><span className="mate-avatar" style={{ background: post.author.avatarColor }}>{post.author.nickname.slice(0, 1)}</span><span><b>{post.author.nickname}</b><small>{new Date(post.meetAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</small></span></div>
            <div className="mate-tags"><span className={`tag ${post.type === 'PACEMAKER' ? 'gold' : ''}`}>{post.type === 'PACEMAKER' ? '페이스메이커' : '러닝 메이트'}</span>{isPreview(post) && <span className="tag">시범 모집</span>}</div>
            <h3>{cleanBody(post.body) || `${post.place}에서 같이 달려요.`}</h3>
            <div className="mate-route"><span><small>집결</small><b>{post.place}</b></span><span><small>페이스</small><b>{fmtPace(post.paceSec)}/km</b></span></div>
            <div className="mate-footer"><span><b>{post._count.applications}/{post.slots}명</b> · {remaining}자리 남음</span><button className={`go ${post.applied ? 'on' : ''}`} type="button" disabled={post.applied || post.isMine || remaining === 0} onClick={() => apply(post)}>{post.isMine ? '내 글' : post.applied ? '신청됨' : remaining === 0 ? '마감' : '신청'}</button></div>
          </article>
        );
      })}{!loading && items.length === 0 && <div className="empty">지금 모집 중인 러너가 없어요.</div>}{loading && <div className="empty">러너 모집을 불러오는 중이에요.</div>}</div>
      <p className="note community-note">‘시범 모집’은 MVP 화면 검증을 위한 예시입니다. 실제 약속으로 오해하지 않도록 정식 운영 전에는 신청하지 말아 주세요.</p>
    </main>
  );
}
