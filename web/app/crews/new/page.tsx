'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { DAEGU_AREAS, daeguAreaByName } from '@/lib/daegu-areas';

const LS = ['아침', '저녁', '주말', '초보환영', '직장인', '대학생'];
export default function NewCrew() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ name: '', description: '', lifestyle: ['저녁'] as string[], paceMin: 6, paceMax: 8, area: '대구 수성구', meetingSpot: '수성못 상화동산 입구', openChatUrl: '', safety: false });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); setErr(''); try {
    const description = `${f.description.trim()}\n주요 집결지: ${f.meetingSpot}`;
    const c = await api.post<{ id: string }>('/crews', { name: f.name, description, lifestyle: f.lifestyle, paceMinSec: Math.min(f.paceMin, f.paceMax) * 60, paceMaxSec: Math.max(f.paceMin, f.paceMax) * 60, area: f.area, openChatUrl: f.openChatUrl || undefined });
    router.push(`/crews/${c.id}`);
  } catch (e: any) { setErr(e.message); setBusy(false); } };
  const valid = step === 1 ? f.name.length >= 2 && f.description.length >= 10 && f.lifestyle.length > 0 : step === 2 ? f.area.length >= 2 && f.meetingSpot.length >= 2 && f.paceMin >= 3 && f.paceMax <= 20 : f.safety;
  return <main className="page host-page">
    <AppHeader back title="정기 크루 개설" />
    <section className="proposal-intro crew-intro"><span>BUILD YOUR CREW</span><h1>우리만의 러닝 리듬을<br />만들어 보세요.</h1><p>소개·페이스·집결지를 먼저 보고 잘 맞는 러너가 참여할 수 있게 해요.</p></section>
    <section className="card proposal-form stack">
      <div className="host-stepper">{['크루 정체성', '활동 조건', '확인'].map((label, index) => <span key={label} className={step >= index + 1 ? 'on' : ''}><b>{index + 1}</b>{label}</span>)}</div>
      {step === 1 && <><div className="proposal-heading"><span>STEP 1</span><h2>어떤 러너와 달릴까요?</h2></div><label className="field">크루 이름<input className="input" value={f.name} onChange={(event) => setF({ ...f, name: event.target.value })} placeholder="예: 수성못 저녁 크루" maxLength={30} /></label><label className="field">소개<textarea className="input" rows={4} value={f.description} onChange={(event) => setF({ ...f, description: event.target.value })} placeholder="활동 요일, 분위기, 초보자 환영 여부를 알려 주세요." /></label><div className="field"><span>라이프스타일</span><div className="pills">{LS.map((tag) => <button key={tag} type="button" className={`pill ${f.lifestyle.includes(tag) ? 'on' : ''}`} onClick={() => setF({ ...f, lifestyle: f.lifestyle.includes(tag) ? f.lifestyle.filter((value) => value !== tag) : [...f.lifestyle, tag] })}>{tag}</button>)}</div></div></>}
      {step === 2 && <><div className="proposal-heading"><span>STEP 2</span><h2>활동 조건을 명확히 알려주세요.</h2></div><div className="two"><label className="field">빠른 페이스(분/km)<input className="input" type="number" min={3} max={15} step={.5} value={f.paceMin} onChange={(event) => setF({ ...f, paceMin: Number(event.target.value) })} /></label><label className="field">느린 페이스(분/km)<input className="input" type="number" min={3} max={20} step={.5} value={f.paceMax} onChange={(event) => setF({ ...f, paceMax: Number(event.target.value) })} /></label></div><label className="field">활동 지역<select className="input" value={f.area} onChange={(event) => { const selected = daeguAreaByName(event.target.value); setF({ ...f, area: selected.fullName, meetingSpot: `${selected.hub} 공개 집결지` }); }}>{DAEGU_AREAS.map((area) => <option value={area.fullName} key={area.slug}>{area.fullName} · {area.hub}</option>)}</select></label><label className="field">주요 공개 집결지<input className="input" value={f.meetingSpot} onChange={(event) => setF({ ...f, meetingSpot: event.target.value })} /><small>자택 주소가 아닌 누구나 알 수 있는 공개 장소를 입력해 주세요.</small></label><label className="field">카카오 오픈채팅 링크(선택)<input className="input" value={f.openChatUrl} onChange={(event) => setF({ ...f, openChatUrl: event.target.value })} placeholder="https://open.kakao.com/o/..." /></label></>}
      {step === 3 && <><div className="proposal-heading"><span>STEP 3</span><h2>공개될 크루 정보를 확인해요.</h2></div><div className="host-preview"><small>{f.lifestyle.join(' · ')}</small><strong>{f.name || '크루 이름'}</strong><p>{f.area} · {Math.min(f.paceMin, f.paceMax).toFixed(1)}~{Math.max(f.paceMin, f.paceMax).toFixed(1)}분/km</p><p>주요 집결지: {f.meetingSpot}</p></div><div className="crew-create-checks"><span>✓ 참여자는 크루 상세에서 페이스와 분위기를 먼저 확인합니다.</span><span>✓ 개설자는 크루를 만들면 자동으로 첫 멤버가 됩니다.</span></div><label className="host-safety"><input type="checkbox" checked={f.safety} onChange={(event) => setF({ ...f, safety: event.target.checked })} /><span>무리한 페이스를 요구하지 않고, 참여자와 집결 장소의 안전을 우선하겠습니다.</span></label></>}
      {err && <div className="form-error">{err}</div>}
      <div className="host-form-actions">{step > 1 && <button className="btn light" type="button" onClick={() => setStep(step - 1)}>이전</button>}<button className="btn" type="button" disabled={busy || !valid} onClick={() => step < 3 ? setStep(step + 1) : submit()}>{step < 3 ? '다음' : busy ? '만드는 중…' : '크루 만들기'}</button></div>
    </section>
  </main>;
}
