'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api, mediaUrl } from '@/lib/api';

interface EventItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  place: string | null;
  startsAt: string;
  capacity: number;
  feeKrw: number;
  tshirt: boolean;
  status: string;
  imageUrl: string | null;
  registered: boolean;
  course: { name: string; distanceM: number } | null;
  _count: { registrations: number };
}

const isPreview = (event: EventItem) => event.title.includes('PREVIEW') || event.description.includes('시범 대회');
const cleanTitle = (value: string) => value.replace(/\s*·\s*PREVIEW$/, '');
const cleanDescription = (value: string) => value.replace(/^\[MVP 시범 대회\]\s*/, '');

export default function EventsPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get<{ items: EventItem[] }>('/events').then((result) => setItems(result.items)).catch(() => setItems([])).finally(() => setLoading(false)); }, []);

  return (
    <main className="page community-page">
      <AppHeader back title="로컬 대회" />
      <section className="race-hero">
        <span className="community-eyebrow">NEXT FINISH LINE</span>
        <h2>대구를 달리는<br />다음 목표를 골라보세요.</h2>
        <p>수변·야경·골목을 주제로 만나는 로컬 러닝 일정입니다.</p>
        <div><span><b>{items.filter((item) => item.status === 'OPEN').length}</b>접수 예정</span><span><b>{items.reduce((sum, item) => sum + item._count.registrations, 0)}</b>참가 표시</span></div>
      </section>

      <div className="section-title community-title"><div><span className="community-eyebrow">RACE CALENDAR</span><h2>대회 일정</h2></div><span>{items.length}개</span></div>
      <div className="race-list">
        {items.map((event, index) => {
          const date = new Date(event.startsAt);
          const remaining = Math.max(0, event.capacity - event._count.registrations);
          const progress = Math.min(100, (event._count.registrations / event.capacity) * 100);
          const dDay = Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
          return (
            <Link key={event.id} href={`/events/${event.slug}`} className="race-card">
              <div className={`race-cover tone-${index % 4}`}>
                {event.imageUrl && <img src={mediaUrl(event.imageUrl)} alt="" />}
                <div className="race-date"><span>{date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span><b>{date.getDate()}</b><small>{date.toLocaleDateString('ko-KR', { weekday: 'short' })}</small></div>
                <span className="race-cover-dday">D-{dDay}</span>
              </div>
              <div className="race-card-body">
                <div className="race-main">
                  <div className="race-tags">
                    <span className={`tag ${event.status === 'OPEN' ? 'green' : ''}`}>{event.status === 'OPEN' ? '접수 중' : event.status}</span>
                    {isPreview(event) && <span className="tag gold">시범 대회</span>}
                    {event.registered && <span className="tag">참가 등록됨</span>}
                  </div>
                  <h3>{cleanTitle(event.title)}</h3>
                  <p className="race-copy">{cleanDescription(event.description)}</p>
                  <dl className="race-facts">
                    <div><dt>코스</dt><dd>{event.course ? `${event.course.name} · ${(event.course.distanceM / 1000).toFixed(1)}K` : '확정 예정'}</dd></div>
                    <div><dt>일시</dt><dd>{date.toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</dd></div>
                    <div><dt>장소</dt><dd>{event.place ?? '공지 예정'}</dd></div>
                  </dl>
                  <div className="race-capacity"><span><b>{event._count.registrations}명</b> 참가 표시 · {remaining}자리 남음</span><strong>{event.feeKrw ? `${event.feeKrw.toLocaleString()}원` : '무료'}</strong></div>
                  <div className="race-progress" aria-label={`정원 ${event.capacity}명 중 ${event._count.registrations}명`}><i style={{ width: `${progress}%` }} /></div>
                </div>
                <span className="community-arrow" aria-hidden="true">→</span>
              </div>
            </Link>
          );
        })}
        {!loading && items.length === 0 && <div className="empty">예정된 대회가 없어요.</div>}
        {loading && <div className="empty">대회 일정을 불러오는 중이에요.</div>}
      </div>
      <p className="note community-note">‘시범 대회’는 MVP 검증을 위한 예시 일정으로 아직 실제 접수가 아닙니다. 일정·참가비·혜택은 정식 공지에서 확인해 주세요.</p>
    </main>
  );
}
