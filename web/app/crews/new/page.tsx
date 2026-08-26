'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';

const LS = ['아침', '저녁', '주말', '초보환영', '직장인', '대학생'];
export default function NewCrew() {
  const router = useRouter();
  const [f, setF] = useState({ name: '', description: '', lifestyle: ['저녁'] as string[], paceMin: 6, paceMax: 8, area: '대구 수성구', openChatUrl: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setErr(''); try { const c = await api.post<{ id: string }>('/crews', { name: f.name, description: f.description, lifestyle: f.lifestyle, paceMinSec: f.paceMin * 60, paceMaxSec: f.paceMax * 60, area: f.area, openChatUrl: f.openChatUrl || undefined }); router.push(`/crews/${c.id}`); } catch (e: any) { setErr(e.message); setBusy(false); } };
  return (
    <main className="page">
      <AppHeader back title="크루 만들기" />
      <div className="card stack">
        <label className="field">크루 이름<input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="예: 수성못 저녁 크루" maxLength={30} /></label>
        <label className="field">소개<textarea className="input" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="언제, 어디서, 어떤 페이스로 달리는지" /></label>
        <div className="field"><span>라이프스타일</span><div className="pills">{LS.map((t) => <button key={t} type="button" className={`pill ${f.lifestyle.includes(t) ? 'on' : ''}`} onClick={() => setF({ ...f, lifestyle: f.lifestyle.includes(t) ? f.lifestyle.filter((x) => x !== t) : [...f.lifestyle, t] })}>{t}</button>)}</div></div>
        <div className="two"><label className="field">페이스 (분/km) 부터<input className="input" type="number" min={3} max={15} value={f.paceMin} onChange={(e) => setF({ ...f, paceMin: Number(e.target.value) })} /></label><label className="field">까지<input className="input" type="number" min={3} max={20} value={f.paceMax} onChange={(e) => setF({ ...f, paceMax: Number(e.target.value) })} /></label></div>
        <label className="field">지역<input className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></label>
        <label className="field">카카오 오픈채팅 링크 (선택)<input className="input" value={f.openChatUrl} onChange={(e) => setF({ ...f, openChatUrl: e.target.value })} placeholder="https://open.kakao.com/o/..." /></label>
        {err && <div style={{ color: 'var(--red)', fontSize: 12.5 }}>{err}</div>}
        <button className="btn" type="button" disabled={busy || f.name.length < 2 || f.lifestyle.length === 0} onClick={submit}>크루 만들기</button>
      </div>
    </main>
  );
}
