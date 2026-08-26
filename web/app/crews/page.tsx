'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { fmtPace } from '@/lib/types';

interface Crew { id: string; name: string; description: string; lifestyle: string[]; paceMinSec: number; paceMaxSec: number; area: string; joined: boolean; _count: { members: number }; runs: { startsAt: string; course: { name: string } | null }[] }
const LS = ['전체', '아침', '저녁', '주말', '초보환영', '직장인'];
export default function CrewsPage() {
  const [ls, setLs] = useState('전체');
  const [items, setItems] = useState<Crew[]>([]);
  useEffect(() => { api.get<{ items: Crew[] }>(`/crews${ls === '전체' ? '' : `?lifestyle=${encodeURIComponent(ls)}`}`).then((r) => setItems(r.items)).catch(() => setItems([])); }, [ls]);
  return (
    <main className="page">
      <AppHeader title="함께 달리기" right={<Link href="/crews/new" className="btn sm">+ 크루</Link>} />
      <div className="two" style={{ marginBottom: 12 }}><Link className="btn light sm" href="/mates" style={{ width: '100%' }}>러닝 메이트 · 페이스메이커</Link><Link className="btn light sm" href="/events" style={{ width: '100%' }}>대회</Link></div>
      <div className="pills" style={{ marginBottom: 12 }}>{LS.map((t) => <button key={t} type="button" className={`pill ${ls === t ? 'on' : ''}`} onClick={() => setLs(t)}>{t}</button>)}</div>
      <div className="stack">{items.map((c) => (
        <Link key={c.id} href={`/crews/${c.id}`} className="list-item">
          <span className="ic">{c.name.slice(0, 1)}</span>
          <div><h4>{c.name} {c.joined && <span className="tag green">참여 중</span>}</h4><p>{c.lifestyle.join(' · ')} · {fmtPace(c.paceMinSec)}~{fmtPace(c.paceMaxSec)} · 멤버 {c._count.members}{c.runs[0] ? ` · 다음 ${new Date(c.runs[0].startsAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} ${c.runs[0].course?.name ?? ''}` : ''}</p></div>
          <span className="go">보기</span>
        </Link>
      ))}{items.length === 0 && <div className="empty">이 라이프스타일의 크루가 아직 없어요. 첫 크루를 만들어 보세요.</div>}</div>
      <p className="note">공개 프로필은 닉네임만 보입니다. 크루·대회 참가는 2단계에서 휴대폰 인증을 마친 사용자만 가능해집니다(익명제).</p>
    </main>
  );
}
