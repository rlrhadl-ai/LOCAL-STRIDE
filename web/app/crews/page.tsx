'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import { fmtPace } from '@/lib/types';

interface Crew {
  id: string;
  name: string;
  description: string;
  lifestyle: string[];
  paceMinSec: number;
  paceMaxSec: number;
  area: string;
  joined: boolean;
  owner: { nickname: string };
  _count: { members: number };
  runs: { startsAt: string; course: { name: string } | null }[];
}

const LIFESTYLES = ['전체', '아침', '저녁', '주말', '초보환영', '직장인'];
const isPreview = (crew: Crew) => crew.description.includes('시범 크루');
const cleanDescription = (value: string) => value.replace(/^\[MVP 시범 크루\]\s*/, '');

export default function CrewsPage() {
  const [lifestyle, setLifestyle] = useState('전체');
  const [items, setItems] = useState<Crew[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<{ items: Crew[] }>(`/crews${lifestyle === '전체' ? '' : `?lifestyle=${encodeURIComponent(lifestyle)}`}`)
      .then((result) => setItems(result.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [lifestyle]);

  return (
    <main className="page community-page">
      <AppHeader title="함께 달리기" right={<Link href="/crews/new" className="btn sm">+ 크루</Link>} />

      <section className="community-hero">
        <span className="community-eyebrow">DAEGU RUNNING COMMUNITY</span>
        <h2>내 생활 속도에 맞는<br /><em>대구 러너</em>를 만나세요.</h2>
        <p>정기 크루부터 오늘의 러닝 메이트, 로컬 대회까지 한곳에서 찾아보세요.</p>
      </section>

      <nav className="community-jumps" aria-label="함께 달리기 메뉴">
        <Link href="/mates" className="community-jump">
          <span className="community-jump-icon mate">M</span>
          <span><strong>러닝 메이트</strong><small>오늘 같이 달릴 사람</small></span>
          <b>→</b>
        </Link>
        <Link href="/events" className="community-jump">
          <span className="community-jump-icon race">R</span>
          <span><strong>로컬 대회</strong><small>다음 목표를 고르기</small></span>
          <b>→</b>
        </Link>
      </nav>

      <div className="section-title community-title"><div><span className="community-eyebrow">대구 크루</span><h2>어떤 시간에 달리나요?</h2></div><span>{items.length}개</span></div>
      <div className="pills community-filters">{LIFESTYLES.map((label) => <button key={label} type="button" className={`pill ${lifestyle === label ? 'on' : ''}`} onClick={() => setLifestyle(label)}>{label}</button>)}</div>

      <div className="community-list">
        {items.map((crew, index) => {
          const run = crew.runs[0];
          return (
            <Link key={crew.id} href={`/crews/${crew.id}`} className="community-card">
              <div className={`community-mark tone-${index % 4}`} aria-hidden="true">{crew.name.slice(0, 1)}</div>
              <div className="community-card-main">
                <div className="community-card-tags">
                  {isPreview(crew) && <span className="tag gold">시범 크루</span>}
                  {crew.joined && <span className="tag green">참여 중</span>}
                  <span className="community-area">{crew.area.replace('대구 ', '')}</span>
                </div>
                <h3>{crew.name}</h3>
                <p>{cleanDescription(crew.description)}</p>
                <div className="community-stats">
                  <span><b>{fmtPace(crew.paceMinSec)}~{fmtPace(crew.paceMaxSec)}</b><small>페이스</small></span>
                  <span><b>{crew._count.members}명</b><small>멤버</small></span>
                  <span><b>{crew.lifestyle.slice(0, 2).join(' · ')}</b><small>라이프스타일</small></span>
                </div>
                {run && <div className="community-next"><span>NEXT</span><b>{new Date(run.startsAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</b><small>{run.course?.name ?? '로컬 자율 코스'}</small></div>}
              </div>
              <span className="community-arrow" aria-hidden="true">→</span>
            </Link>
          );
        })}
        {!loading && items.length === 0 && <div className="empty">이 라이프스타일의 크루가 아직 없어요. 첫 크루를 만들어 보세요.</div>}
        {loading && <div className="empty">대구 크루를 불러오는 중이에요.</div>}
      </div>
      <p className="note community-note">‘시범 크루’는 MVP 화면 검증을 위한 예시입니다. 일정과 집결지는 정식 운영 전 다시 알려드립니다.</p>
    </main>
  );
}
