'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { HAZARD_CATEGORY, HAZARD_SEVERITY, sendHazard } from '@/lib/hazards';
import type { Course, LatLng } from '@/lib/types';

const LocationMap = dynamic(() => import('./HazardLocationMap'), { ssr: false });
export default function HazardReportForm({ course, onSubmitted, onCancel }: { course: Course; onSubmitted: (id: string) => void; onCancel: () => void }) {
  const [account, setAccount] = useState<'loading' | 'yes' | 'no' | 'error'>('loading');
  const [point, setPoint] = useState<LatLng | null>(null), [accuracy, setAccuracy] = useState<number | null>(null);
  const [source, setSource] = useState<'GPS' | 'MAP'>('GPS'), [locating, setLocating] = useState(false);
  const [category, setCategory] = useState('SURFACE'), [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState(''), [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null), [preview, setPreview] = useState('');
  const [error, setError] = useState(''), [locationMessage, setLocationMessage] = useState('');
  const [saving, setSaving] = useState(false), [sessionRetry, setSessionRetry] = useState(0);
  const requestId = useRef(''), busy = useRef(false), geoTicket = useRef(0);
  useEffect(() => {
    const tickets = geoTicket;
    let alive = true; setAccount('loading');
    api.get<{ user: unknown }>('/auth/session').then((r) => alive && setAccount(r.user ? 'yes' : 'no')).catch(() => alive && setAccount('error'));
    return () => { alive = false; tickets.current++; };
  }, [sessionRetry]);
  useEffect(() => { if (!photo) { setPreview(''); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  function choose(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('JPG·PNG·WebP 사진을 5MB 이하로 선택해 주세요.'); return; }
    setPhoto(file); setError('');
  }
  function locate() {
    if (!navigator.geolocation) { setLocationMessage('위치를 사용할 수 없어요. 지도에서 지점을 선택해 주세요.'); return; }
    const ticket = ++geoTicket.current;
    setLocating(true); setLocationMessage('현재 위치를 확인하고 있어요.');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (ticket !== geoTicket.current) return;
      setLocating(false);
      if (coords.accuracy > 100) { setLocationMessage(`GPS 오차가 약 ${Math.round(coords.accuracy)}m예요. 다시 찾거나 지도에서 지점을 선택해 주세요.`); return; }
      setPoint([coords.latitude, coords.longitude]); setAccuracy(coords.accuracy); setSource('GPS');
      setLocationMessage(`GPS 위치를 찾았어요. 오차 약 ${Math.round(coords.accuracy)}m. 실제 파손 지점을 지도에서 확인해 주세요.`);
    }, () => { if (ticket === geoTicket.current) { setLocating(false); setLocationMessage('위치 권한 또는 수신 상태를 확인해 주세요. 지도에서 직접 선택할 수도 있어요.'); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current || !point || !photo || !consent) return;
    busy.current = true; setSaving(true); setError('');
    // Keep the token on a failed/uncertain request so retry never duplicates a saved report.
    requestId.current ||= crypto.randomUUID();
    const body = new FormData();
    Object.entries({ requestId: requestId.current, courseId: course.id, category, severity, description, lat: point[0], lng: point[1], locationSource: source, consent: 'true' }).forEach(([k, v]) => body.append(k, String(v)));
    if (accuracy != null) body.append('accuracyM', String(accuracy));
    body.append('photo', photo);
    try { const result = await sendHazard(body); onSubmitted(result.id); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setAccount('no'); setError(e instanceof Error ? e.message : '전송에 실패했어요. 다시 시도해 주세요.'); }
    finally { busy.current = false; setSaving(false); }
  }
  if (account === 'loading') return <p role="status">로그인 상태를 확인하고 있어요.</p>;
  if (account === 'error') return <div role="alert">로그인 상태를 확인하지 못했어요. <button type="button" className="btn light" onClick={() => setSessionRetry((n) => n + 1)}>다시 확인</button></div>;
  if (account === 'no') return <div className="hazard-login"><p>사진 신고는 로그인 후 이용할 수 있어요. 다른 러너의 신고는 로그인 없이 볼 수 있습니다.</p><Link className="btn gold" href={`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}>로그인 후 신고</Link><button type="button" className="btn light" onClick={onCancel}>닫기</button></div>;
  return <form className="hazard-form" onSubmit={submit}>
    <p>안전한 곳에 멈춘 뒤 촬영해 주세요. {course.name}의 파손 지점을 기록합니다.</p>
    <fieldset disabled={saving}>
      <legend>1. 현장 사진</legend>
      <div className="hazard-actions"><label className="btn gold">현장 촬영<input aria-label="현장 사진 촬영" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} /></label><label className="btn light">사진 선택<input aria-label="현장 사진 선택" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ''; }} /></label></div>
      <small>사진 1장, 5MB 이하. 얼굴·차량번호·연락처가 보이지 않게 촬영해 주세요.</small>
      {preview && <img src={preview} alt="신고할 현장 사진 미리보기" className="hazard-preview" />}
    </fieldset>
    <fieldset disabled={saving}>
      <legend>2. 파손 위치</legend>
      <button type="button" className="btn light" onClick={locate} disabled={locating}>{locating ? 'GPS 확인 중…' : 'GPS로 현재 위치 찾기'}</button>
      <p className="note" role="status">{locationMessage || '위치 찾기를 누르거나 지도에서 파손 지점을 선택해 주세요.'}</p>
      <div className="hazard-map"><LocationMap route={course.polyline} point={point} onPick={saving ? undefined : (p) => { geoTicket.current++; setLocating(false); setPoint(p); setSource('MAP'); setAccuracy(null); setLocationMessage('지도에서 선택한 위치로 신고합니다.'); }} /></div>
      <small>{point ? `${source === 'GPS' ? 'GPS' : '지도 선택'} · ${point[0].toFixed(6)}, ${point[1].toFixed(6)}` : '아직 위치를 선택하지 않았어요.'}</small>
    </fieldset>
    <fieldset disabled={saving}>
      <legend>3. 상황 설명</legend>
      <label className="field">문제 유형<select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(HAZARD_CATEGORY).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label>
      <label className="field">위험 정도<select className="input" value={severity} onChange={(e) => setSeverity(e.target.value)}>{Object.entries(HAZARD_SEVERITY).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label>
      <label className="field">어떤 상황인가요? (5~500자)<textarea className="input" rows={3} minLength={5} maxLength={500} required value={description} onChange={(e) => setDescription(e.target.value)} placeholder="예: 수변 데크 입구의 바닥 판자가 들떠 있어요." /></label>
      <label className="hazard-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} required /><span>선택한 위치·유형은 즉시 공개되며, 사진·설명은 관리자 확인 후 다른 이용자에게 공개되는 것에 동의합니다. 신고자 정보는 공개하지 않습니다.</span></label>
    </fieldset>
    {error && <p className="hazard-error" role="alert">{error}</p>}
    <div className="hazard-actions"><button type="button" className="btn light" disabled={saving} onClick={onCancel}>닫기</button><button className="btn gold" disabled={saving || !point || !photo || !consent || description.trim().length < 5}>{saving ? '신고 전송 중…' : '사진과 위치 신고하기'}</button></div>
    <small>이 신고는 LOCAL STRIDE 운영팀에 접수됩니다. 지자체 민원 자동 접수 기능은 아닙니다.</small>
  </form>;
}
