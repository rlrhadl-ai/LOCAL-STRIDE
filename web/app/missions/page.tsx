'use client';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';

interface Reward {
  type: 'COUPON' | 'LOCAL_CURRENCY';
  title: string;
  amountKrw: number;
  status: 'DEMO' | 'ACTIVE';
  notice?: string;
  claimed: boolean;
  claimCode: string | null;
}
interface Mission { id: string; code: string; type: string; title: string; description: string; periodEnd: string; rule: any; rewardText: string | null; reward: Reward | null; progress: { value: number; done: boolean } }
interface Medal { code: string; name: string; description: string; earned: boolean }
interface Challenge { code: string; name: string; description: string; targetCount: number; completed: string[] }

const missionTarget = (mission: Mission) => mission.type === 'PERIOD_DISTANCE' ? mission.rule.targetM ?? 10000 : mission.rule.count ?? 1;
const progressText = (mission: Mission) => mission.type === 'PERIOD_DISTANCE'
  ? (mission.progress.value / 1000).toFixed(1) + ' / ' + (missionTarget(mission) / 1000).toFixed(0) + 'km'
  : Math.min(mission.progress.value, missionTarget(mission)) + ' / ' + missionTarget(mission) + '회';
const missionIcon = (mission: Mission) => mission.reward?.type === 'LOCAL_CURRENCY' ? '₩' : mission.type === 'MIRACLE_RUN' ? '☀' : mission.type === 'LOCAL_FOOD' ? 'L' : mission.type === 'CHECKIN' ? '✓' : 'K';

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [medals, setMedals] = useState<Medal[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [message, setMessage] = useState('');
  const [busyCode, setBusyCode] = useState('');

  const loadMissions = () => api.get<{ items: Mission[] }>('/missions').then((result) => setMissions(result.items));
  useEffect(() => {
    loadMissions().catch(() => undefined);
    api.get<{ medals: Medal[]; challenges: Challenge[] }>('/medals').then((result) => { setMedals(result.medals); setChallenges(result.challenges); }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const proof = (mission: Mission) => {
    if (!('geolocation' in navigator)) return setMessage('위치 정보를 지원하지 않는 기기예요.');
    setBusyCode(mission.code);
    navigator.geolocation.getCurrentPosition(
      (position) => api.post<{ merchant: string; distance: number }>('/missions/' + mission.code + '/proof', { lat: position.coords.latitude, lng: position.coords.longitude })
        .then(async (result) => { setMessage(result.merchant + '에서 위치 인증을 완료했어요. 이제 보상을 받을 수 있습니다.'); await loadMissions(); })
        .catch((error) => setMessage(error.message))
        .finally(() => setBusyCode('')),
      () => { setMessage('매장 방문 인증에는 위치 권한이 필요해요.'); setBusyCode(''); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const claim = async (mission: Mission) => {
    setBusyCode(mission.code);
    try {
      const result = await api.post<{ alreadyClaimed: boolean; code: string; reward: Reward }>('/missions/' + mission.code + '/claim');
      setMessage(result.reward.type === 'LOCAL_CURRENCY'
        ? result.reward.title + ' 지급 예정 리워드가 내 지갑에 등록됐어요.'
        : result.reward.title + '을 내 지갑에 담았어요.');
      await loadMissions();
    } catch (error: any) { setMessage(error.message); }
    finally { setBusyCode(''); }
  };

  const rewardCount = missions.filter((mission) => mission.reward).length;
  const completedCount = missions.filter((mission) => mission.progress.done).length;
  const displayedMissions = [...missions].sort((a, b) => Number(b.reward?.type === 'LOCAL_CURRENCY') - Number(a.reward?.type === 'LOCAL_CURRENCY'));
  return (
    <main className="page mission-page">
      <AppHeader back title="미션 · 리워드" />
      <section className="mission-hero">
        <span>RUN LOCAL · SPEND LOCAL</span>
        <h2>달린 만큼 쌓이는<br /><em>대구 로컬 리워드</em></h2>
        <p>GPS 러닝과 동네 체크인을 완료하고 로컬 쿠폰과 지역화폐 연계 리워드를 받아보세요.</p>
        <div><span><b>{completedCount}</b>완료 미션</span><span><b>{rewardCount}</b>리워드 미션</span><span><b>{missions.filter((mission) => mission.reward?.claimed).length}</b>받은 보상</span></div>
      </section>

      {message && <div className="mission-message" role="status">{message}</div>}
      <div className="section-title mission-section-title"><div><span>MONTHLY MISSIONS</span><h2>이번 달 미션</h2></div><small>{missions[0] ? new Date(missions[0].periodEnd).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) + '까지' : '매월 갱신'}</small></div>
      <div className="mission-list">{displayedMissions.map((mission) => {
        const target = missionTarget(mission);
        const percent = Math.min(100, (mission.progress.value / target) * 100);
        const localPay = mission.reward?.type === 'LOCAL_CURRENCY';
        return (
          <article key={mission.id} className={'mission-rich ' + (mission.progress.done ? 'done ' : '') + (localPay ? 'local-pay' : '')}>
            <div className="mission-rich-top">
              <span className="mission-rich-icon">{mission.progress.done ? '✓' : missionIcon(mission)}</span>
              <div><div className="mission-rich-tags">{localPay && <span className="tag gold">지역화폐</span>}{mission.reward?.status === 'DEMO' && <span className="tag">시범 리워드</span>}</div><h3>{mission.title}</h3><p>{mission.description}</p></div>
            </div>
            <div className="mission-progress-line"><span>{progressText(mission)}</span><b>{Math.round(percent)}%</b></div>
            <div className="mission-progress"><i style={{ width: percent + '%' }} /></div>
            {mission.reward ? <div className="mission-reward">
              <span className="mission-reward-mark">{localPay ? '₩' : 'C'}</span>
              <div><small>완료 리워드</small><strong>{mission.reward.title}</strong><p>{mission.reward.notice ?? '미션 완료 후 내 리워드 지갑에서 확인할 수 있어요.'}</p></div>
              {mission.progress.done
                ? mission.reward.claimed
                  ? <span className="mission-claimed">{localPay ? '지급 예정' : '받음'}</span>
                  : <button className="btn sm" type="button" disabled={busyCode === mission.code} onClick={() => claim(mission)}>{busyCode === mission.code ? '처리 중' : '보상 받기'}</button>
                : mission.type === 'LOCAL_FOOD'
                  ? <button className="btn sm" type="button" disabled={busyCode === mission.code} onClick={() => proof(mission)}>{busyCode === mission.code ? '확인 중' : '위치 인증'}</button>
                  : <span className="mission-locked">완료 후 수령</span>}
            </div> : <div className="mission-reward medal-reward"><span className="mission-reward-mark">M</span><div><small>완료 리워드</small><strong>{mission.rewardText ?? '완주 메달'}</strong><p>GPS 완주가 확인되면 자동으로 지급됩니다.</p></div><span className="mission-locked">{mission.progress.done ? '지급됨' : '자동 지급'}</span></div>}
          </article>
        );
      })}{missions.length === 0 && <div className="empty">진행 중인 미션이 없어요.</div>}</div>

      <p className="mission-disclaimer">지역화폐 리워드는 현재 서비스 검증용 ‘지급 예정’ 항목입니다. 대구로페이 운영기관 및 제휴처와의 연동이 확정되기 전에는 실제 잔액으로 충전되지 않습니다.</p>

      {challenges.map((challenge) => <section key={challenge.code} className="card challenge mission-challenge"><div className="row"><div><span>LOCAL CHALLENGE</span><h4>{challenge.name}</h4></div><b>{challenge.completed.length} / {challenge.targetCount}</b></div><div className="bar"><i style={{ width: (challenge.completed.length / challenge.targetCount) * 100 + '%' }} /></div><p>{challenge.description}</p></section>)}
      <div className="section-title mission-section-title"><div><span>COLLECTION</span><h2>메달 컬렉션</h2></div><small>{medals.filter((medal) => medal.earned).length} / {medals.length}</small></div>
      <div className="stack">{medals.map((medal) => <div key={medal.code} className="list-item"><div className={'medal small ' + (medal.earned ? '' : 'locked')}>{medal.earned ? medal.name.split(' ')[0] : '?'}</div><div><h4>{medal.name}</h4><p>{medal.description}</p></div><span className={'tag ' + (medal.earned ? 'gold' : '')}>{medal.earned ? '획득' : '미획득'}</span></div>)}</div>
    </main>
  );
}
