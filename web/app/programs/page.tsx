'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { api, ApiError, mediaUrl } from '@/lib/api';
import { fmtPace, type RunProgram } from '@/lib/types';

const KIND: Record<RunProgram['kind'], string> = { MORNING: '아침런', AFTER_WORK: '퇴근런', INDEPENDENT: '독립런', THEME: '주제형 러닝', POPUP: '번개런' };

export default function ProgramsPage() {
  const router = useRouter();
  const [items, setItems] = useState<RunProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const load = () => api.get<{ items: RunProgram[] }>('/programs').then((result) => setItems(result.items)).finally(() => setLoading(false));
  useEffect(() => { load().catch(() => setMessage('러닝 일정을 잠시 불러오지 못했어요.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function join(program: RunProgram) {
    setBusy(program.id); setMessage('');
    try { await api.post(`/programs/${program.id}/join`); setMessage('참가 신청이 완료됐어요. 집결 시간과 장소를 확인해 주세요.'); await load(); }
    catch (error) { if (error instanceof ApiError && error.status === 401) return router.push('/login?next=/programs'); setMessage(error instanceof Error ? error.message : '신청하지 못했습니다.'); }
    finally { setBusy(null); }
  }

  async function cancel(program: RunProgram) {
    if (!window.confirm(`‘${program.title}’ 참가 신청을 취소할까요?`)) return;
    setBusy(program.id); setMessage('');
    try { await api.post(`/programs/${program.id}/cancel`); setMessage('참가 신청을 취소했습니다.'); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : '취소하지 못했습니다.'); }
    finally { setBusy(null); }
  }

  return <main className="page programs-page">
    <AppHeader back title="대구 러닝 프로그램" />
    <section className="programs-intro"><span>RUN LIKE A LOCAL</span><h1>대구 사람과 함께 뛰는<br />진짜 로컬 러닝</h1><p>처음 와도 괜찮아요. 대구 로컬 호스트가 집결부터 완주 후 쉬어갈 장소까지 함께 안내합니다.</p></section>
    {message && <div className="program-message" role="status">{message}</div>}
    <div className="program-filter"><b>다가오는 일정</b><span>{items.length}개의 러닝</span></div>
    <div className="program-list">
      {items.map((program) => {
        const date = new Date(program.startsAt);
        return <article className="program-card" key={program.id}>
          <div className={`program-visual kind-${program.kind.toLowerCase().replace('_', '-')}`}>
            {program.imageUrl && <img src={mediaUrl(program.imageUrl)} alt="" />}
            <span>{KIND[program.kind]}</span><b>{program.course ? `${(program.course.distanceM / 1000).toFixed(1)}K` : 'LOCAL'}</b>
          </div>
          <div className="program-content">
            <div className="program-date"><time dateTime={program.startsAt}>{date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} · {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time><em>{program.remaining > 0 ? `남은 자리 ${program.remaining}` : '모집 마감'}</em></div>
            <h2>{program.title}</h2><p>{program.description}</p>
            <div className="program-facts"><div><span>집결</span><b>{program.place}</b></div><div><span>페이스</span><b>{program.paceSec ? fmtPace(program.paceSec) : '함께 조율'}</b></div><div><span>참가비</span><b>{program.feeKrw ? `${program.feeKrw.toLocaleString()}원` : '무료'}</b></div></div>
            {program.host && <div className="program-host">
              <div className="program-avatar" style={{ background: program.host.avatarColor }}>{program.host.avatarUrl ? <img src={mediaUrl(program.host.avatarUrl)} alt="" /> : program.host.nickname.slice(0, 1)}</div>
              <div><span>LOCAL HOST</span><strong>{program.host.nickname}{program.host.phoneVerified && <i>인증</i>}</strong><p>{program.host.bio || `${program.host.homeArea}에서 활동하는 로컬 러너`}</p></div>
              <small>러닝 {program.host.runCount}회</small>
            </div>}
            <button type="button" className={`program-join ${program.registered ? 'registered' : ''}`} disabled={busy === program.id || (!program.registered && program.remaining <= 0)} onClick={() => program.registered ? cancel(program) : join(program)}>{busy === program.id ? '처리 중…' : program.registered ? '참가 확정 · 취소하기' : program.remaining > 0 ? '이 러닝에 참가하기' : '모집이 마감됐어요'}</button>
          </div>
        </article>;
      })}
      {!loading && items.length === 0 && <div className="empty">예정된 로컬 러닝을 준비하고 있어요.</div>}
      {loading && <div className="empty">대구 러닝 일정을 불러오는 중이에요.</div>}
    </div>
    <p className="program-safety">러닝 일정과 집결 장소는 운영 상황에 따라 변경될 수 있습니다. 참가 전 알림과 호스트 안내를 꼭 확인해 주세요.</p>
  </main>;
}
