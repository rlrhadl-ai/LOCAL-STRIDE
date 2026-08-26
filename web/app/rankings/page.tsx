'use client';
import { useEffect, useState } from 'react';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { fmtPace, fmtTime, type Course } from '@/lib/types';

interface DistRank { rank: number; nickname: string; avatarColor: string; distanceM: number; runs: number; isMe: boolean }
interface BestRank { rank: number; nickname: string; avatarColor: string; durationSec: number; avgPaceSec: number | null; isMe: boolean }
export default function RankingsPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const [dist, setDist] = useState<DistRank[]>([]);
  const [best, setBest] = useState<BestRank[]>([]);
  useEffect(() => { api.get<{ items: Course[] }>('/courses').then((r) => { setCourses(r.items); if (!courseId && r.items[0]) setCourseId(r.items[0].id); }).catch(() => null); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get<{ distance: DistRank[]; courseBest: BestRank[] }>(`/rankings?period=${period}${courseId ? `&courseId=${courseId}` : ''}`).then((r) => { setDist(r.distance); setBest(r.courseBest); }).catch(() => null); }, [period, courseId]);
  return (
    <main className="page">
      <AppHeader back title="랭킹" />
      <div className="pills" style={{ marginBottom: 12 }}>{([['week', '이번 주'], ['month', '이번 달'], ['all', '전체']] as const).map(([v, l]) => <button key={v} type="button" className={`pill ${period === v ? 'on' : ''}`} onClick={() => setPeriod(v)}>{l}</button>)}</div>
      <div className="section-title"><h2>거리 랭킹</h2><span>검증된 완주만 집계</span></div>
      <div className="stack">{dist.map((r) => <div key={r.rank} className={`rank ${r.isMe ? 'me' : ''}`}><span className={`pos ${r.rank <= 3 ? 'top' : ''}`}>{r.rank}</span><span className="av" style={{ background: r.avatarColor }}>{r.nickname.slice(0, 1)}</span><span>{r.nickname}{r.isMe ? ' (나)' : ''}<div className="muted" style={{ fontSize: 11 }}>{r.runs}회</div></span><b>{(r.distanceM / 1000).toFixed(1)}km</b></div>)}{dist.length === 0 && <div className="empty">아직 기록이 없어요 — 첫 완주를 해보세요</div>}</div>
      <div className="section-title"><h2>코스 베스트</h2></div>
      <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ marginBottom: 10 }}>{courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <div className="stack">{best.map((r) => <div key={r.rank} className={`rank ${r.isMe ? 'me' : ''}`}><span className={`pos ${r.rank <= 3 ? 'top' : ''}`}>{r.rank}</span><span className="av" style={{ background: r.avatarColor }}>{r.nickname.slice(0, 1)}</span><span>{r.nickname}{r.isMe ? ' (나)' : ''}<div className="muted" style={{ fontSize: 11 }}>{r.avgPaceSec ? fmtPace(r.avgPaceSec) : ''}</div></span><b>{fmtTime(r.durationSec)}</b></div>)}{best.length === 0 && <div className="empty">이 코스의 기록이 아직 없어요</div>}</div>
      <p className="note">GPS 이상치(페이스 2'30" 미만, 25분/km 초과, 점프)는 완주 검증에서 걸러져 랭킹에 오르지 않습니다.</p>
    </main>
  );
}
