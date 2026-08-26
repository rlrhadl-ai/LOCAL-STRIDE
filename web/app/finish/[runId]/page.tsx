'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import RecordCard from '@/components/RecordCard';
import AgentLog, { type LogEntry } from '@/components/AgentLog';
import { api } from '@/lib/api';
import { fmtTime, type FinishSummary } from '@/lib/types';

export default function FinishPage() {
  const { runId } = useParams<{ runId: string }>();
  const [sum, setSum] = useState<FinishSummary | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [courseName, setCourseName] = useState('러닝');
  const [chal, setChal] = useState(0);
  const [coupon, setCoupon] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(`ls_finish_${runId}`);
    if (raw) { const d = JSON.parse(raw); setSum(d.summary); setLog(d.log ?? []); setCourseName(d.courseName ?? '러닝'); }
    else api.get<any>(`/runs/${runId}`).then((r) => { setCourseName(r.course.name); setSum({ valid: r.valid, invalidReason: r.invalidReason, distanceM: r.distanceM, durationSec: r.durationSec, avgPaceSec: r.avgPaceSec ?? 0, pace: r.avgPaceSec ? `${Math.floor(r.avgPaceSec / 60)}'${String(r.avgPaceSec % 60).padStart(2, '0')}"` : '-', checkins: r.checkins.length, checkpoints: r.course.checkpoints.length, medal: r.medals[0] ? { code: r.medals[0].medal.code, name: r.medals[0].medal.name, description: r.medals[0].medal.description, isNew: false } : null, coupon: r.coupons[0] ? { code: r.coupons[0].code, title: r.coupons[0].coupon.title, discountKrw: r.coupons[0].coupon.discountKrw, merchant: r.coupons[0].coupon.merchant.name, validUntil: r.coupons[0].coupon.validUntil } : null, challenge: null, missions: [], medalCollection: [], profile: { totalKm: 0, courses: 0, medals: 0 } }); }).catch(() => null);
  }, [runId]);
  useEffect(() => { if (sum?.challenge) { setChal(sum.challenge.before); const t = setTimeout(() => setChal(sum.challenge!.after), 500); return () => clearTimeout(t); } }, [sum]);

  if (!sum) return <main className="page no-tab"><div className="empty">결과를 불러오는 중…</div></main>;
  const cols = ['#E4B23A', '#fff', '#7CF2A7', '#8FD3FF', '#FF9A62'];
  return (
    <main className="page no-tab">
      <div className="finish-hero">
        <div className="confetti">{Array.from({ length: 26 }).map((_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, background: cols[i % 5], animationDelay: `${(i % 7) * .12}s`, animationDuration: `${1.8 + (i % 4) * .3}s` }} />)}</div>
        <div className="eyebrow">{sum.valid ? 'FINISH' : 'RUN RECORDED'}</div>
        <h2>{(sum.distanceM / 1000).toFixed(1)}km {sum.valid ? '완주!' : '기록'}</h2>
        <div className="sub">{courseName}{sum.valid ? ' · 리워드가 지급되었습니다' : ` · ${sum.invalidReason ?? '검증 실패'} — 랭킹·메달에는 반영되지 않아요`}</div>
        <div className="frow"><div><b>{fmtTime(sum.durationSec)}</b><span>시간</span></div><div><b>{sum.pace}</b><span>페이스</span></div><div><b>{sum.checkins} / {sum.checkpoints}</b><span>체크인</span></div></div>
      </div>
      {sum.medal && (
        <div className="card medal-card" style={{ marginTop: 12 }}>
          <div className="medal">{sum.medal.name.split(' ').slice(0, 2).map((w, i) => <span key={i} style={{ display: 'block' }}>{w}</span>)}</div>
          <div><span className="tag gold">{sum.medal.isNew ? '새 메달' : '이미 보유'}</span><h4 style={{ marginTop: 6 }}>{sum.medal.name}</h4><p>{sum.medal.description}</p>
            {sum.medalCollection.length > 0 && <div className="medal-row">{sum.medalCollection.map((m) => <span key={m.code} className={`${m.earned ? 'got' : ''} ${m.isNew ? 'new' : ''}`}>{m.earned ? m.name.split(' ')[0] : '?'}</span>)}</div>}
          </div>
        </div>
      )}
      {sum.challenge && (
        <div className="card challenge"><div className="row"><h4>{sum.challenge.name}</h4><span className="muted">{chal} / {sum.challenge.target}</span></div><div className="bar"><i style={{ width: `${(chal / sum.challenge.target) * 100}%` }} /></div><p>{sum.challenge.target}개 코스를 완주하고 한정 메달을 모으세요</p></div>
      )}
      {sum.coupon && (
        <div className="card reward-card"><div><div className="eyebrow">완주 리워드 · 로컬 쿠폰</div><h4>{sum.coupon.merchant}</h4><div className="amt">{sum.coupon.title}</div><p>{coupon ? `코드 ${sum.coupon.code}` : `${new Date(sum.coupon.validUntil).toLocaleDateString('ko-KR')}까지 · 제휴 전 가상 혜택`}</p></div><button type="button" onClick={() => setCoupon((v) => !v)}>{coupon ? '닫기' : '쿠폰 보기'}</button></div>
      )}
      {sum.missions.length > 0 && (
        <><div className="section-title"><h2>미션 진행</h2><Link href="/missions">전체 보기</Link></div>
        <div className="stack">{sum.missions.map((m) => <div key={m.code} className={`mission ${m.done ? 'done' : ''}`}><span className="n">{m.done ? '✓' : '·'}</span><div><h4>{m.title}</h4><p>{m.type === 'PERIOD_DISTANCE' ? `${(m.value / 1000).toFixed(1)}km 누적` : `${m.value}회`}</p></div><span className="tag">{m.done ? '완료' : '진행 중'}</span></div>)}</div></>
      )}
      <div className="card" style={{ marginTop: 10 }}>
        <h4 style={{ margin: '0 0 2px', fontSize: 14 }}>MY RECORD 카드</h4><p className="muted" style={{ margin: 0, fontSize: 11.5 }}>SNS 공유용 완주 기록 카드 · 자동 생성</p>
        <RecordCard courseName={courseName} distanceM={sum.distanceM} durationSec={sum.durationSec} pace={sum.pace} checkins={sum.checkins} checkpoints={sum.checkpoints} medalName={sum.medal?.name ?? null} challenge={sum.challenge ? `${sum.challenge.name} ${sum.challenge.after}/${sum.challenge.target}` : null} couponTitle={sum.coupon?.title ?? null} />
      </div>
      <div className="two" style={{ margin: '12px 0' }}><Link className="btn light" href="/">홈으로</Link><Link className="btn" href="/rankings">랭킹 보기</Link></div>
      {log.length > 0 && <div style={{ margin: '0 -14px' }}><AgentLog entries={log} /></div>}
    </main>
  );
}
