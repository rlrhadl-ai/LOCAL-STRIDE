'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';

interface Me { user: { nickname: string; avatarColor: string; phoneVerified: boolean; kakaoId: string | null }; stats: { totalKm: number; runs: number; courses: number; medals: number; level: number; levelName: string }; medals: { medal: { name: string } }[]; coupons: { id: string; code: string; usedAt: string | null; coupon: { title: string; validUntil: string; merchant: { name: string } } }[]; challenges: { challenge: { name: string; targetCount: number }; completedSlugs: string[] }[]; crews: { id: string; name: string }[] }
export default function MePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [nick, setNick] = useState('');
  const [msg, setMsg] = useState('');
  const load = () => api.get<Me>('/me').then((m) => { setMe(m); setNick(m.user.nickname); }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const save = async () => { try { await api.patch('/me', { nickname: nick }); await load(); setMsg('닉네임 변경 완료'); } catch (e: any) { setMsg(e.message); } };
  const use = async (code: string) => { try { await api.post(`/me/coupons/${code}/use`); await load(); setMsg('쿠폰 사용 처리 — 매장 정산은 2단계'); } catch (e: any) { setMsg(e.message); } };
  if (!me) return <main className="page"><AppHeader title="마이" /><div className="empty">{msg || '불러오는 중…'}</div></main>;
  return (
    <main className="page">
      <AppHeader title="마이 페이지" />
      <div className="profile"><div className="who"><div className="avatar" style={{ color: me.user.avatarColor }}>{me.user.nickname.slice(0, 1)}</div><div><h3>{me.user.nickname}</h3><div className="lv">Lv.{me.stats.level} {me.stats.levelName} · {me.user.phoneVerified ? '신원 확인 완료' : '익명 (기기 ID)'}</div></div></div><div className="prow"><div><b>{me.stats.totalKm.toFixed(1)}</b><span>총 거리 (km)</span></div><div><b>{me.stats.courses}</b><span>완주 코스</span></div><div><b>{me.stats.medals}</b><span>획득 메달</span></div></div></div>
      <div className="card" style={{ marginTop: 12 }}><label className="field">공개 닉네임 (익명제)<div style={{ display: 'flex', gap: 6 }}><input className="input" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={16} /><button className="btn sm" type="button" onClick={save}>저장</button></div></label>{msg && <div className="note">{msg}</div>}</div>
      <div className="section-title"><h2>내 활동</h2></div>
      <div className="menu">
        <Link href="/missions">미션 · 메달 <span>{me.challenges[0] ? `${me.challenges[0].challenge.name} ${me.challenges[0].completedSlugs.length}/${me.challenges[0].challenge.targetCount}` : `메달 ${me.stats.medals}`}</span></Link>
        <Link href="/rankings">랭킹 <span>{me.stats.runs}회 완주</span></Link>
        <Link href="/courses?mine=1">내 코스 <span>만들기 ›</span></Link>
        <Link href="/crews">내 크루 <span>{me.crews.map((c) => c.name).join(', ') || '없음'}</span></Link>
      </div>
      <div className="section-title"><h2>내 쿠폰</h2><span>{me.coupons.filter((c) => !c.usedAt).length}장 사용 가능</span></div>
      <div className="stack">{me.coupons.map((c) => <div key={c.id} className="list-item" style={{ opacity: c.usedAt ? .5 : 1 }}><span className="ic" style={{ background: 'var(--gold-soft)', color: '#8A6410' }}>₩</span><div><h4>{c.coupon.title}</h4><p>{c.coupon.merchant.name} · {c.code} · {new Date(c.coupon.validUntil).toLocaleDateString('ko-KR')}까지</p></div>{c.usedAt ? <span className="tag">사용됨</span> : <button className="go" type="button" onClick={() => use(c.code)}>사용</button>}</div>)}{me.coupons.length === 0 && <div className="empty">완주하면 로컬 쿠폰이 지급돼요</div>}</div>
      <p className="note">카카오 로그인·휴대폰 인증은 2단계. 지금은 이 기기에서만 기록이 이어집니다.</p>
    </main>
  );
}
