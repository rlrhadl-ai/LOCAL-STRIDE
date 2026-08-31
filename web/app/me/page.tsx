'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useDaeguArea } from '@/components/DaeguAreaProvider';
import { api, mediaUrl } from '@/lib/api';
import { DAEGU_AREA_OPTIONS } from '@/lib/daegu-areas';
import { buildRunnerInsight, rankEvents, type InsightRun, type RecommendationCandidate } from '@/lib/runner-insights';
import { fmtPace, type RunProgram } from '@/lib/types';

interface ProfileUser {
  nickname: string; email: string | null; role: 'USER' | 'ADMIN'; avatarColor: string; avatarUrl: string | null;
  bio: string | null; homeArea: string; weeklyGoalKm: number; preferredPaceSec: number | null;
  phoneVerified: boolean; kakaoId: string | null; isAuthenticated: boolean;
}
interface Me {
  user: ProfileUser;
  stats: { totalKm: number; runs: number; courses: number; medals: number; level: number; levelName: string };
  medals: { medal: { name: string } }[];
  coupons: { id: string; code: string; usedAt: string | null; coupon: { title: string; discountKrw: number; validUntil: string; merchant: { name: string; category: string } } }[];
  challenges: { challenge: { name: string; targetCount: number }; completedSlugs: string[] }[];
  crews: { id: string; name: string }[];
}
interface MeRun extends InsightRun { id: string; course: { name: string; slug: string } }
interface RaceEvent {
  id: string; slug: string; title: string; description: string; place: string | null; startsAt: string;
  feeKrw: number; status: string; course: { name: string; distanceM: number } | null;
}
type EditProfile = Pick<ProfileUser, 'nickname' | 'avatarColor' | 'bio' | 'homeArea' | 'weeklyGoalKm' | 'preferredPaceSec'>;
const COLORS = ['#1B5BDF', '#0A1D52', '#117A65', '#E05A3F', '#7C4DCC', '#C48A12'];
const paceText = (seconds: number | null) => seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '';
const paceSeconds = (value: string) => {
  if (!value.trim()) return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error('선호 페이스는 6:30처럼 입력해 주세요');
  const total = Number(match[1]) * 60 + Number(match[2]);
  if (total < 180 || total > 900 || Number(match[2]) > 59) throw new Error('선호 페이스는 3:00~15:00 사이로 입력해 주세요');
  return total;
};

export default function MePage() {
  const router = useRouter();
  const { setAreaSlug } = useDaeguArea();
  const [me, setMe] = useState<Me | null>(null);
  const [edit, setEdit] = useState<EditProfile | null>(null);
  const [pace, setPace] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [runs, setRuns] = useState<MeRun[]>([]);
  const [programs, setPrograms] = useState<RunProgram[]>([]);
  const [events, setEvents] = useState<RaceEvent[]>([]);
  const [recommendationFeedback, setRecommendationFeedback] = useState<Record<string, string>>({});

  const load = () => api.get<Me>('/me').then((value) => {
    setMe(value);
    setEdit({ nickname: value.user.nickname, avatarColor: value.user.avatarColor, bio: value.user.bio, homeArea: value.user.homeArea, weeklyGoalKm: value.user.weeklyGoalKm, preferredPaceSec: value.user.preferredPaceSec });
    setPace(paceText(value.user.preferredPaceSec));
  }).catch((error) => setMsg(error.message));
  useEffect(() => {
    load();
    Promise.all([
      api.get<{ items: MeRun[] }>('/me/runs').then((result) => result.items).catch(() => []),
      api.get<{ items: RunProgram[] }>('/programs').then((result) => result.items).catch(() => []),
      api.get<{ items: RaceEvent[] }>('/events').then((result) => result.items).catch(() => []),
    ]).then(([runItems, programItems, eventItems]) => { setRuns(runItems); setPrograms(programItems); setEvents(eventItems); });
    try { setRecommendationFeedback(JSON.parse(localStorage.getItem('ls_event_recommendation_feedback') || '{}')); } catch { /* ignore damaged local draft */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const insight = useMemo(() => me ? buildRunnerInsight(runs, me.user) : null, [me, runs]);
  const recommendations = useMemo(() => {
    if (!me || !insight) return [];
    const programCandidates: RecommendationCandidate[] = programs.map((program) => ({
      id: `program-${program.id}`, href: '/programs', title: program.title, description: program.description,
      startsAt: program.startsAt, place: program.place, distanceM: program.course?.distanceM || null,
      paceSec: program.paceSec, feeKrw: program.feeKrw, typeLabel: '로컬 프로그램', preview: !program.registrationEnabled,
    }));
    const raceCandidates: RecommendationCandidate[] = events.map((event) => ({
      id: `race-${event.id}`, href: `/events/${event.slug}`, title: event.title.replace(/\s*·\s*PREVIEW$/, ''), description: event.description.replace(/^\[MVP 시범 대회\]\s*/, ''),
      startsAt: event.startsAt, place: event.place, distanceM: event.course?.distanceM || null,
      paceSec: null, feeKrw: event.feeKrw, typeLabel: '로컬 대회', preview: event.title.includes('PREVIEW') || event.description.includes('시범'),
    }));
    return rankEvents([...programCandidates, ...raceCandidates], insight, me.user);
  }, [events, insight, me, programs]);

  const saveRecommendationFeedback = (id: string, value: string) => {
    const next = { ...recommendationFeedback, [id]: value };
    setRecommendationFeedback(next); localStorage.setItem('ls_event_recommendation_feedback', JSON.stringify(next));
  };

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!edit) return; setSaving(true); setMsg('');
    try {
      await api.patch('/me', { ...edit, bio: edit.bio || null, weeklyGoalKm: Number(edit.weeklyGoalKm), preferredPaceSec: paceSeconds(pace) });
      setAreaSlug(edit.homeArea); await load(); setMsg('프로필을 저장하고 활동 지역을 추천 기준에 반영했습니다.');
    } catch (error) { setMsg(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다'); }
    finally { setSaving(false); }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault(); setMsg('');
    if (passwords.next !== passwords.confirm) return setMsg('새 비밀번호가 서로 일치하지 않습니다.');
    try {
      await api.patch('/auth/password', { currentPassword: passwords.current, newPassword: passwords.next });
      setPasswords({ current: '', next: '', confirm: '' }); setMsg('비밀번호를 변경했습니다.');
    } catch (error) { setMsg(error instanceof Error ? error.message : '비밀번호를 변경하지 못했습니다'); }
  }
  async function logout() {
    await api.post('/auth/logout').catch(() => undefined); router.replace('/'); router.refresh();
  }
  async function redeemCoupon(code: string) {
    try { await api.post(`/me/coupons/${code}/use`); await load(); setMsg('쿠폰을 사용 처리했습니다.'); }
    catch (error) { setMsg(error instanceof Error ? error.message : '쿠폰을 처리하지 못했습니다'); }
  }

  if (!me || !edit) return <main className="page"><AppHeader title="마이" /><div className="empty">{msg || '프로필을 불러오는 중…'}</div></main>;
  const user = me.user;
  const availableRewards = me.coupons.filter((coupon) => !coupon.usedAt);
  return <main className="page">
    <AppHeader title="마이 페이지" right={user.isAuthenticated ? <span className="account-status">로그인됨</span> : <Link className="header-login" href="/login">로그인</Link>} />

    <section className="profile profile-rich">
      <div className="who"><div className="avatar" style={{ background: user.avatarColor, color: '#fff' }}>{user.avatarUrl ? <img src={mediaUrl(user.avatarUrl)} alt="" /> : user.nickname.slice(0, 1)}</div><div><div className="profile-name-row"><h3>{user.nickname}</h3>{user.role === 'ADMIN' && <span>ADMIN</span>}</div><div className="lv">{insight?.label || me.stats.levelName} · {user.homeArea}</div></div></div>
      {user.bio && <p className="profile-bio">{user.bio}</p>}
      <div className="prow"><div><b>{me.stats.totalKm.toFixed(1)}</b><span>총 거리 (km)</span></div><div><b>{me.stats.courses}</b><span>완주 코스</span></div><div><b>{me.stats.medals}</b><span>획득 메달</span></div></div>
    </section>

    {!user.isAuthenticated && <section className="account-callout"><div><span>기록을 안전하게 보관하세요</span><h2>이 기기의 기록을 내 계정으로</h2><p>가입하면 지금까지의 러닝 기록을 그대로 연결하고 여러 기기에서 로그인할 수 있어요.</p></div><div><Link className="btn" href="/signup">회원가입</Link><Link className="btn light" href="/login">로그인</Link></div></section>}

    {insight && <section className="runner-insight-section">
      <div className="section-title profile-section-title"><div><span>AI MATCH · 근거 공개</span><h2>내 러닝 인사이트</h2></div><small>추천 신뢰도 {insight.confidence}</small></div>
      <div className="runner-insight-card">
        <div className="runner-insight-head"><div><strong>{insight.label}</strong><p>{insight.sourceLabel} · 최근 4주 기준</p></div><span className={insight.recentRuns >= 3 ? 'measured' : 'declared'}>{insight.recentRuns >= 3 ? '측정됨' : '직접 설정'}</span></div>
        <div className="runner-insight-metrics">
          <div><b>{insight.runsPerWeek}</b><span>주당 러닝</span></div>
          <div><b>{insight.averageKm || '-'}</b><span>평균 km</span></div>
          <div><b>{insight.paceSec ? fmtPace(insight.paceSec) : '-'}</b><span>기준 페이스</span></div>
          <div><b>{insight.favoriteTime}</b><span>주 활동 시간</span></div>
        </div>
        {insight.recentRuns < 3 && <p className="runner-insight-note">아직 실제 기록이 충분하지 않아 주간 목표·선호 페이스로 초기 추천합니다. 3회 이상 완주하면 측정 기록 기반으로 전환됩니다.</p>}
      </div>

      <div className="section-title recommendation-title"><div><span>WHY THIS EVENT</span><h2>나에게 맞는 행사</h2></div><small>{insight.recentRuns >= 3 ? '기록 기반 적합도' : '등록 일정 비교 · 초기 추정'}</small></div>
      <div className="event-recommendation-list">{recommendations.map((recommendation) => <article className="event-recommendation" key={recommendation.id}>
        <div className={`event-recommendation-score ${insight.recentRuns < 3 ? 'initial' : ''}`}><strong>{insight.recentRuns >= 3 ? recommendation.score : '초기'}</strong><span>{insight.recentRuns >= 3 ? '적합도' : '추천'}</span></div>
        <div className="event-recommendation-main"><div className="event-recommendation-tags"><span>{recommendation.typeLabel}</span>{recommendation.preview && <span>시범 일정</span>}<time>{new Date(recommendation.startsAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}</time></div><h3>{recommendation.title}</h3><ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>{recommendation.caution && <p className="event-recommendation-caution">주의 · {recommendation.caution}</p>}<div className="event-recommendation-actions"><Link href={recommendation.href}>일정 보기</Link>{recommendationFeedback[recommendation.id] ? <span>의견 반영됨 · {recommendationFeedback[recommendation.id]}</span> : <><button type="button" onClick={() => saveRecommendationFeedback(recommendation.id, '관심 있음')}>관심 있어요</button><button type="button" onClick={() => saveRecommendationFeedback(recommendation.id, '시간 불일치')}>시간이 안 맞아요</button></>}</div></div>
      </article>)}{recommendations.length === 0 && <div className="empty compact">추천할 수 있는 예정 행사를 불러오는 중이에요.</div>}</div>
      <p className="recommendation-policy">AI는 행사를 새로 만들지 않고 등록된 일정만 비교합니다. 3회 미만에는 숫자 점수 대신 직접 설정을 활용한 초기 추천을 표시하고, 기록이 쌓이면 거리·페이스·시간·활동 지역 기반 적합도를 보여줍니다.</p>
    </section>}

    <section className="profile-editor card">
      <div className="section-title profile-section-title"><div><span>RUNNER PROFILE</span><h2>내 프로필 관리</h2></div><small>{user.email || '기기 전용 익명 프로필'}</small></div>
      <form onSubmit={saveProfile} className="profile-form">
        <label className="field">공개 닉네임<input className="input" value={edit.nickname} onChange={(event) => setEdit({ ...edit, nickname: event.target.value })} minLength={2} maxLength={16} required /></label>
        <label className="field">한 줄 소개<textarea className="input" rows={3} value={edit.bio || ''} onChange={(event) => setEdit({ ...edit, bio: event.target.value })} maxLength={160} placeholder="달리는 이유나 좋아하는 코스를 소개해 보세요" /></label>
        <div className="profile-grid"><label className="field">활동 지역<select className="input" value={edit.homeArea} onChange={(event) => setEdit({ ...edit, homeArea: event.target.value })} required>{!DAEGU_AREA_OPTIONS.includes(edit.homeArea) && <option value={edit.homeArea}>{edit.homeArea}</option>}{DAEGU_AREA_OPTIONS.map((area) => <option value={area} key={area}>{area}</option>)}</select></label><label className="field">주간 목표(km)<input className="input" type="number" min="1" max="500" value={edit.weeklyGoalKm} onChange={(event) => setEdit({ ...edit, weeklyGoalKm: Number(event.target.value) })} required /></label></div>
        <label className="field">선호 페이스 (분/km)<input className="input" value={pace} onChange={(event) => setPace(event.target.value)} placeholder="예: 6:30" inputMode="numeric" /></label>
        <fieldset className="profile-colors"><legend>프로필 컬러</legend><div>{COLORS.map((color) => <button key={color} type="button" className={edit.avatarColor === color ? 'on' : ''} style={{ background: color }} aria-label={`${color} 선택`} onClick={() => setEdit({ ...edit, avatarColor: color })} />)}</div></fieldset>
        <button className="btn" disabled={saving}>{saving ? '저장 중…' : '프로필 저장'}</button>
      </form>
      {msg && <p className="profile-message" role="status">{msg}</p>}
    </section>

    {user.isAuthenticated && <section className="card account-card"><div className="section-title profile-section-title"><div><span>ACCOUNT</span><h2>계정 및 보안</h2></div></div><div className="account-summary"><div><span>로그인 이메일</span><strong>{user.email}</strong></div><div><span>계정 권한</span><strong>{user.role === 'ADMIN' ? '관리자 · 일반 회원' : '일반 회원'}</strong></div></div><form className="password-form" onSubmit={changePassword}><label className="field">현재 비밀번호<input className="input" type="password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} autoComplete="current-password" required /></label><div className="profile-grid"><label className="field">새 비밀번호<input className="input" type="password" minLength={8} value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} autoComplete="new-password" required /></label><label className="field">새 비밀번호 확인<input className="input" type="password" minLength={8} value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} autoComplete="new-password" required /></label></div><button className="btn light sm">비밀번호 변경</button></form><div className="account-actions">{user.role === 'ADMIN' && <Link className="btn light" href="/admin">관리자 콘솔</Link>}<button className="btn ghost" type="button" onClick={logout}>로그아웃</button></div></section>}

    <div className="section-title"><h2>내 활동</h2></div>
    <div className="menu"><Link href="/missions">미션 · 메달 <span>{me.challenges[0] ? `${me.challenges[0].challenge.name} ${me.challenges[0].completedSlugs.length}/${me.challenges[0].challenge.targetCount}` : `메달 ${me.stats.medals}`}</span></Link><Link href="/rankings">랭킹 <span>{me.stats.runs}회 완주</span></Link><Link href="/courses?mine=1">내 코스 <span>만들기 ›</span></Link><Link href="/crews">내 크루 <span>{me.crews.map((crew) => crew.name).join(', ') || '없음'}</span></Link><Link href="/host">러닝 개최하기 <span>번개런 · 크루 · 행사 제안 ›</span></Link></div>
    <div className="section-title"><h2>내 리워드 지갑</h2><span>{availableRewards.length}개 보유</span></div>
    <div className="reward-wallet">{me.coupons.map((coupon) => {
      const localCurrency = coupon.coupon.merchant.category === '지역화폐 리워드';
      const demoCoupon = coupon.code.startsWith('DEMO-');
      return <div key={coupon.id} className={'wallet-item ' + (localCurrency ? 'local-currency ' : '') + (demoCoupon ? 'demo-coupon ' : '') + (coupon.usedAt ? 'used' : '')}><span className="wallet-mark">{localCurrency ? '₩' : demoCoupon ? 'RD' : 'C'}</span><div><div className="wallet-tags">{localCurrency && <span className="tag gold">지역화폐</span>}{demoCoupon && <span className="tag gold">데모 쿠폰</span>}<span className="tag">{coupon.coupon.discountKrw.toLocaleString()}원</span></div><h4>{coupon.coupon.title}</h4><p>{coupon.coupon.merchant.name} · {new Date(coupon.coupon.validUntil).toLocaleDateString('ko-KR')}까지</p><small>{coupon.code}</small></div>{coupon.usedAt ? <span className="wallet-status">사용됨</span> : localCurrency ? <span className="wallet-status pending">지급 예정</span> : demoCoupon ? <span className="wallet-status pending">시연용</span> : <button className="go" type="button" onClick={() => redeemCoupon(coupon.code)}>사용</button>}</div>;
    })}{me.coupons.length === 0 && <div className="empty">미션이나 코스를 완주하면 로컬 리워드가 지급돼요.</div>}</div>
    {me.coupons.some((coupon) => coupon.coupon.merchant.category === '지역화폐 리워드') && <p className="mission-disclaimer wallet-notice">지역화폐 ‘지급 예정’ 항목은 운영기관 연계 전 시범 리워드이며, 아직 실제 대구로페이 잔액은 아닙니다.</p>}
    {me.coupons.some((coupon) => coupon.code.startsWith('DEMO-')) && <p className="mission-disclaimer wallet-notice">‘러너스데이’ 쿠폰은 서비스 소개와 화면 시연을 위한 더미 데이터이며 실제 매장에서 사용할 수 없습니다.</p>}
  </main>;
}
