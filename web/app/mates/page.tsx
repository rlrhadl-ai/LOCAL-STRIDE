'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { DAEGU_AREAS, daeguAreaByName, daeguAreaFromText } from '@/lib/daegu-areas';
import { useDaeguAreaFilter } from '@/lib/use-daegu-area-filter';
import { fmtPace } from '@/lib/types';

interface Post { id: string; type: 'PACEMAKER' | 'MATE'; paceSec: number; meetAt: string; place: string; slots: number; body: string; applied: boolean; isMine: boolean; author: { nickname: string; avatarColor: string }; _count: { applications: number } }
interface RunnerProfile { user: { preferredPaceSec: number | null; homeArea: string } }
const isPreview = (post: Post) => post.body.startsWith('[시범 모집]');
const cleanBody = (value: string) => value.replace(/^\[시범 모집\]\s*/, '');
const district = (value: string) => daeguAreaFromText(value)?.name || '기타';
const distanceFromPost = (post: Post) => {
  const match = cleanBody(post.body).match(/^\[(\d+(?:\.\d+)?)km\b/);
  return match ? Number(match[1]) : null;
};

export default function MatesPage() {
  const [type, setType] = useState<'' | 'PACEMAKER' | 'MATE'>('');
  const [items, setItems] = useState<Post[]>([]);
  const [profile, setProfile] = useState<RunnerProfile['user'] | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [timeFilter, setTimeFilter] = useState<'ALL' | '48H' | 'WEEKEND'>('ALL');
  const { areaFilter, setAreaFilter } = useDaeguAreaFilter();
  const [paceOnly, setPaceOnly] = useState(false);
  const [targetDistance, setTargetDistance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'MATE' as 'MATE' | 'PACEMAKER', area: '수성구', distanceKm: 5, paceMin: 6, paceMax: 7, meetAt: '', place: '수성못 상화동산 입구', slots: 4, body: '', safety: false });
  const [message, setMessage] = useState('');

  const load = () => { setLoading(true); return api.get<{ items: Post[] }>(`/mates${type ? `?type=${type}` : ''}`).then((result) => {
    const seen = new Set<string>();
    setItems(result.items.filter((post) => {
      if (new Date(post.meetAt).getTime() <= Date.now()) return false;
      const key = `${post.author.nickname}|${post.type}|${post.meetAt}|${post.place}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }));
  }).catch(() => setItems([])).finally(() => setLoading(false)); };

  useEffect(() => { load(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    api.get<RunnerProfile>('/me').then((result) => {
      setProfile(result.user);
      if (result.user.preferredPaceSec) {
        const minutes = Math.round(result.user.preferredPaceSec / 30) / 2;
        setForm((current) => ({ ...current, paceMin: Math.max(3, minutes - .5), paceMax: Math.min(15, minutes + .5) }));
      }
    }).catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === '1') setOpen(true);
    const requestedDistance = Number(params.get('distance'));
    if (requestedDistance >= 1 && requestedDistance <= 50) {
      setTargetDistance(requestedDistance);
      setForm((current) => ({ ...current, distanceKm: requestedDistance }));
    }
    const requestedArea = params.get('area');
    if (requestedArea && requestedArea !== 'all') { const selected = daeguAreaByName(requestedArea); setForm((current) => ({ ...current, area: selected.name, place: `${selected.hub} 공개 집결지` })); }
  }, []);

  const scoredItems = useMemo(() => items.map((post) => {
    const paceGap = profile?.preferredPaceSec ? Math.abs(post.paceSec - profile.preferredPaceSec) : null;
    const areaMatch = Boolean(profile && district(profile.homeArea) !== '기타' && district(profile.homeArea) === district(post.place));
    const postDistance = distanceFromPost(post);
    const distanceGap = targetDistance != null && postDistance != null ? Math.abs(postDistance - targetDistance) : null;
    let score = 35;
    if (paceGap != null) score += paceGap <= 45 ? 28 : paceGap <= 90 ? 14 : 2;
    else score += 10;
    score += areaMatch ? 18 : 6;
    score += distanceGap == null ? 8 : distanceGap <= 1 ? 15 : distanceGap <= 3 ? 8 : 1;
    const reasons = [paceGap == null ? '선호 페이스 설정 후 정밀 비교' : paceGap <= 45 ? `내 페이스와 ${Math.round(paceGap / 6) / 10}분 차이` : '페이스 차이 확인 필요', areaMatch ? `내 활동 지역 ${district(post.place)}` : `${district(post.place)} 집결`, distanceGap == null ? '모집 거리 확인 필요' : `${postDistance}km · 목표와 ${distanceGap}km 차이`];
    return { post, score: Math.min(98, score), paceGap, reasons };
  }).filter(({ post, paceGap }) => {
    const when = new Date(post.meetAt); const hours = (when.getTime() - Date.now()) / 3600000;
    if (timeFilter === '48H' && hours > 48) return false;
    if (timeFilter === 'WEEKEND' && ![0, 6].includes(when.getDay())) return false;
    if (areaFilter !== '전체' && district(post.place) !== areaFilter) return false;
    if (paceOnly && (paceGap == null || paceGap > 45)) return false;
    return true;
  }).sort((a, b) => b.score - a.score || new Date(a.post.meetAt).getTime() - new Date(b.post.meetAt).getTime()), [areaFilter, items, paceOnly, profile, targetDistance, timeFilter]);

  const apply = async (post: Post) => { try { await api.post(`/mates/${post.id}/apply`); setMessage('신청 완료 — 닉네임으로만 공개됩니다.'); await load(); } catch (error: any) { setMessage(error.message); } };
  const create = async () => { try {
    const paceMin = Math.min(form.paceMin, form.paceMax); const paceMax = Math.max(form.paceMin, form.paceMax);
    const detail = `[${form.distanceKm}km · ${paceMin.toFixed(1)}~${paceMax.toFixed(1)}분/km]`;
    await api.post('/mates', { type: form.type, paceSec: Math.round(((paceMin + paceMax) / 2) * 60), meetAt: new Date(form.meetAt).toISOString(), place: form.place, slots: form.slots, body: `${detail} ${form.body}`.trim() });
    setOpen(false); setStep(1); setMessage('모집글을 올렸어요. 신청 인원을 확인해 주세요.'); await load();
  } catch (error: any) { setMessage(error.message); } };
  const stepValid = step === 1 ? Boolean(form.meetAt && form.place.length >= 2 && new Date(form.meetAt).getTime() > Date.now()) : step === 2 ? form.distanceKm > 0 && form.paceMin >= 3 && form.paceMax <= 15 && form.slots > 0 : form.body.length >= 5 && form.safety;

  return (
    <main className="page community-page">
      <AppHeader back title="러닝 메이트" right={<button className="btn sm" type="button" onClick={() => { if (!open && areaFilter !== '전체') { const selected = daeguAreaByName(areaFilter); setForm((current) => ({ ...current, area: selected.name, place: `${selected.hub} 공개 집결지` })); } setOpen((value) => !value); setStep(1); }}>{open ? '닫기' : '모집하기'}</button>} />
      <section className="mate-hero"><span className="community-eyebrow">RUN TOGETHER, TODAY</span><h2>내 페이스와 시간에 맞는<br />대구 러너를 찾아보세요.</h2><p>페이스·지역·시간을 비교해 잘 맞는 모집부터 보여드려요.</p></section>

      {open && <section className="card mate-form stack">
        <div className="host-stepper" aria-label="모집 작성 단계">{['언제·어디서', '어떻게', '확인'].map((label, index) => <span key={label} className={step >= index + 1 ? 'on' : ''}><b>{index + 1}</b>{label}</span>)}</div>
        {step === 1 && <><div><span className="community-eyebrow">STEP 1</span><h3>언제, 어디서 만날까요?</h3></div><label className="field">지역<select className="input" value={form.area} onChange={(event) => { const selected = daeguAreaByName(event.target.value); setForm({ ...form, area: selected.name, place: `${selected.hub} 공개 집결지` }); }}>{DAEGU_AREAS.map((area) => <option value={area.name} key={area.slug}>{area.fullName} · {area.hub}</option>)}</select></label><label className="field">일시<input className="input" type="datetime-local" value={form.meetAt} onChange={(event) => setForm({ ...form, meetAt: event.target.value })} /></label><label className="field">공개 집결 장소<input className="input" value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} /><small>집 주소가 아닌 광장·입구·안내소 같은 공개된 장소를 입력해 주세요.</small></label></>}
        {step === 2 && <><div><span className="community-eyebrow">STEP 2</span><h3>함께 달릴 방식을 정해요.</h3></div><div className="pills"><button type="button" className={`pill ${form.type === 'MATE' ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 'MATE' })}>러닝 메이트</button><button type="button" className={`pill ${form.type === 'PACEMAKER' ? 'on' : ''}`} onClick={() => setForm({ ...form, type: 'PACEMAKER' })}>페이스메이커</button></div><div className="two"><label className="field">거리(km)<input className="input" type="number" min={1} max={50} step={.5} value={form.distanceKm} onChange={(event) => setForm({ ...form, distanceKm: Number(event.target.value) })} /></label><label className="field">모집 인원<input className="input" type="number" min={1} max={30} value={form.slots} onChange={(event) => setForm({ ...form, slots: Number(event.target.value) })} /></label></div><div className="two"><label className="field">느린 페이스(분/km)<input className="input" type="number" step={.5} min={3} max={15} value={form.paceMax} onChange={(event) => setForm({ ...form, paceMax: Number(event.target.value) })} /></label><label className="field">빠른 페이스(분/km)<input className="input" type="number" step={.5} min={3} max={15} value={form.paceMin} onChange={(event) => setForm({ ...form, paceMin: Number(event.target.value) })} /></label></div></>}
        {step === 3 && <><div><span className="community-eyebrow">STEP 3</span><h3>모집글을 확인해 주세요.</h3></div><label className="field">한마디<textarea className="input" rows={3} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="예: 수성못 5K를 대화 가능한 속도로 같이 달려요" /></label><div className="host-preview"><small>공개될 내용</small><strong>{form.type === 'MATE' ? '러닝 메이트' : '페이스메이커'} · {form.distanceKm}km</strong><p>{form.place} · {form.paceMin.toFixed(1)}~{form.paceMax.toFixed(1)}분/km · {form.slots}명</p></div><label className="host-safety"><input type="checkbox" checked={form.safety} onChange={(event) => setForm({ ...form, safety: event.target.checked })} /><span>공개된 집결지를 사용했고, 무리한 페이스를 요구하지 않겠습니다.</span></label></>}
        <div className="host-form-actions">{step > 1 && <button className="btn light" type="button" onClick={() => setStep(step - 1)}>이전</button>}<button className="btn" type="button" disabled={!stepValid} onClick={() => step < 3 ? setStep(step + 1) : create()}>{step < 3 ? '다음' : '모집 올리기'}</button></div>
      </section>}

      <section className="mate-match-panel"><div><span>MATCH BASIS</span><strong>{[targetDistance ? `${targetDistance}km` : '', profile?.preferredPaceSec ? `${fmtPace(profile.preferredPaceSec)}/km` : '', profile?.homeArea || ''].filter(Boolean).join(' · ') || '초기 맞춤 순'}</strong><small>{targetDistance ? '홈에서 고른 거리와 프로필의 페이스·지역을 함께 비교해요.' : profile?.preferredPaceSec ? '내 프로필의 페이스·활동 지역으로 정렬' : '내 정보에서 선호 페이스를 설정하면 맞춤도가 정확해져요.'}</small></div><Link href="/me">기준 수정</Link></section>
      <div className="pills community-filters mate-filters">{([['', '전체'], ['PACEMAKER', '페이스메이커'], ['MATE', '러닝 메이트']] as const).map(([value, label]) => <button key={value} type="button" className={`pill ${type === value ? 'on' : ''}`} onClick={() => setType(value)}>{label}</button>)}</div>
      <div className="mate-filter-grid"><label>일정<select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as typeof timeFilter)}><option value="ALL">전체</option><option value="48H">48시간 이내</option><option value="WEEKEND">주말</option></select></label><label>지역<select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}><option>전체</option>{DAEGU_AREAS.map((area) => <option key={area.slug}>{area.name}</option>)}</select></label><label className="mate-check"><input type="checkbox" checked={paceOnly} onChange={(event) => setPaceOnly(event.target.checked)} />내 페이스 ±45초</label></div>

      {message && <div className="note mate-message" aria-live="polite">{message}</div>}
      <div className="section-title community-title"><div><span className="community-eyebrow">OPEN RUNS</span><h2>맞춤 러너 모집</h2></div><span>{scoredItems.length}개</span></div>
      <div className="mate-list">{scoredItems.map(({ post, score, reasons }) => {
        const remaining = Math.max(0, post.slots - post._count.applications);
        return <article key={post.id} className="mate-card">
          <div className="mate-card-top"><div className="mate-author"><span className="mate-avatar" style={{ background: post.author.avatarColor }}>{post.author.nickname.slice(0, 1)}</span><span><b>{post.author.nickname}</b><small>{new Date(post.meetAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</small></span></div><span className="mate-match-score">{profile?.preferredPaceSec || targetDistance ? `${score}% 맞춤` : '초기 추천'}</span></div>
          <div className="mate-tags"><span className={`tag ${post.type === 'PACEMAKER' ? 'gold' : ''}`}>{post.type === 'PACEMAKER' ? '페이스메이커' : '러닝 메이트'}</span>{isPreview(post) && <span className="tag">시범 모집</span>}</div>
          <h3>{cleanBody(post.body) || `${post.place}에서 같이 달려요.`}</h3><div className="mate-match-reasons">{reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
          <div className="mate-route"><span><small>집결</small><b>{post.place}</b></span><span><small>페이스</small><b>{fmtPace(post.paceSec)}/km</b></span></div>
          <div className="mate-footer"><span><b>{post._count.applications}/{post.slots}명</b> · {isPreview(post) ? 'MVP 예시' : `${remaining}자리 남음`}</span><button className={`go ${post.applied ? 'on' : ''}`} type="button" disabled={isPreview(post) || post.applied || post.isMine || remaining === 0} onClick={() => apply(post)}>{isPreview(post) ? '시범' : post.isMine ? '내 글' : post.applied ? '신청됨' : remaining === 0 ? '마감' : '신청'}</button></div>
        </article>;
      })}{!loading && scoredItems.length === 0 && <div className="empty">조건에 맞는 모집이 없어요. 필터를 넓히거나 직접 모집해 보세요.</div>}{loading && <div className="empty">러너 모집을 불러오는 중이에요.</div>}</div>
      <p className="note community-note">맞춤도는 선호 페이스와 활동 지역을 비교한 참고 지표입니다. 실제 체력·날씨·코스를 확인하고 신청해 주세요.</p>
    </main>
  );
}
