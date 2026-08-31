'use client';
import { useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { DAEGU_AREAS, daeguAreaByName } from '@/lib/daegu-areas';

export default function EventProposalPage() {
  const [step, setStep] = useState(1);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ title: '', purpose: '', area: '대구 수성구', place: '', date: '', distanceKm: 5, capacity: 50, partner: '', safety: '', contact: '', consent: false });
  const valid = step === 1 ? form.title.length >= 2 && form.purpose.length >= 10 : step === 2 ? Boolean(form.place && form.date && form.distanceKm > 0 && form.capacity >= 10) : form.safety.length >= 10 && form.contact.length >= 5 && form.consent;
  const save = () => { localStorage.setItem('localstride_event_proposal_draft', JSON.stringify({ ...form, savedAt: new Date().toISOString() })); setSaved(true); };
  return <main className="page host-page">
    <AppHeader back title="공식 행사 제안" />
    <section className="proposal-intro"><span>OPERATOR REVIEW</span><h1>로컬 러닝 행사 제안서</h1><p>이 단계에서는 공개되지 않습니다. 제안 내용과 안전 계획을 운영자가 검토한 뒤 등록하는 구조입니다.</p></section>
    <section className="card proposal-form stack">
      <div className="host-stepper">{['기획', '운영', '안전·확인'].map((label, index) => <span className={step >= index + 1 ? 'on' : ''} key={label}><b>{index + 1}</b>{label}</span>)}</div>
      {step === 1 && <><div className="proposal-heading"><span>STEP 1</span><h2>왜 이 행사를 열고 싶은가요?</h2></div><label className="field">행사명<input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 대구 로컬 나이트런" /></label><label className="field">기획 목적과 로컬 연결점<textarea className="input" rows={5} value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} placeholder="러너의 문제를 어떻게 해결하고, 어떤 상점·관광지와 연결되는지 적어 주세요." /></label><label className="field">주요 지역<select className="input" value={form.area} onChange={(event) => { const selected = daeguAreaByName(event.target.value); setForm({ ...form, area: selected.fullName, place: `${selected.hub} – 예정 코스` }); }}>{DAEGU_AREAS.map((area) => <option value={area.fullName} key={area.slug}>{area.fullName} · {area.hub}</option>)}</select></label></>}
      {step === 2 && <><div className="proposal-heading"><span>STEP 2</span><h2>실제 운영 조건을 알려주세요.</h2></div><label className="field">집결지·예정 코스<input className="input" value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} placeholder="예: 공원 입구 – 수변길 왕복" /></label><div className="two"><label className="field">예정 일시<input className="input" type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label className="field">예상 참가자<input className="input" type="number" min={10} max={5000} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Number(event.target.value) })} /></label></div><div className="two"><label className="field">거리(km)<input className="input" type="number" min={1} max={100} step={.5} value={form.distanceKm} onChange={(event) => setForm({ ...form, distanceKm: Number(event.target.value) })} /></label><label className="field">협력 상점·기관(선택)<input className="input" value={form.partner} onChange={(event) => setForm({ ...form, partner: event.target.value })} /></label></div></>}
      {step === 3 && <><div className="proposal-heading"><span>STEP 3</span><h2>안전 계획과 연락처를 확인해요.</h2></div><label className="field">안전·통제·응급 계획<textarea className="input" rows={5} value={form.safety} onChange={(event) => setForm({ ...form, safety: event.target.value })} placeholder="차량 통제, 횡단보도, 안전요원, 긴급 연락 방법을 적어 주세요." /></label><label className="field">담당자 연락처<input className="input" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="이메일 또는 전화번호" /></label><div className="host-preview"><small>검토용 요약</small><strong>{form.title || '행사명 미입력'}</strong><p>{form.area} · {form.distanceKm}km · {form.capacity}명 · {form.partner || '협력처 미정'}</p></div><label className="host-safety"><input type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>제안서는 바로 공개되지 않으며, 운영자 검토와 안전·협력처 확인이 필요함을 확인했습니다.</span></label></>}
      <div className="host-form-actions">{step > 1 && <button className="btn light" type="button" onClick={() => setStep(step - 1)}>이전</button>}<button className="btn" type="button" disabled={!valid} onClick={() => step < 3 ? setStep(step + 1) : save()}>{step < 3 ? '다음' : '검토 요청 초안 저장'}</button></div>
      {saved && <div className="proposal-saved" role="status">이 기기에 제안 초안을 저장했어요. 현재 MVP에서는 운영자에게 자동 제출되지 않습니다.</div>}
    </section>
    <p className="proposal-disclaimer">시연 범위: 제안 정보 입력·검토 절차를 보여주는 MVP입니다. 실제 행사 접수·승인 알림은 관리자 워크플로 연결 후 제공됩니다.</p>
  </main>;
}
