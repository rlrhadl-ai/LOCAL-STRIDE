'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';

interface Ev { id: string; slug: string; title: string; description: string; startsAt: string; capacity: number; feeKrw: number; tshirt: boolean; status: string; registered: boolean; course: { name: string; distanceM: number } | null; _count: { registrations: number } }
export default function EventsPage() {
  const [items, setItems] = useState<Ev[]>([]);
  useEffect(() => { api.get<{ items: Ev[] }>('/events').then((r) => setItems(r.items)).catch(() => null); }, []);
  return (
    <main className="page">
      <AppHeader back title="대회" />
      <div className="stack">{items.map((e) => (
        <Link key={e.id} href={`/events/${e.slug}`} className="card" style={{ display: 'block' }}>
          <div className="row"><span className={`tag ${e.status === 'OPEN' ? 'green' : ''}`}>{e.status === 'OPEN' ? '접수 중' : e.status}</span>{e.registered && <span className="tag gold">참가 등록됨</span>}</div>
          <h3 style={{ margin: '8px 0 4px', fontSize: 17 }}>{e.title}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>{new Date(e.startsAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric' })} · {e.course ? `${e.course.name} ${(e.course.distanceM / 1000).toFixed(1)}km` : ''} · {e._count.registrations}/{e.capacity}명 · {e.feeKrw ? `${e.feeKrw.toLocaleString()}원` : '무료'}{e.tshirt ? ' · 티셔츠 제공' : ''}</p>
        </Link>
      ))}{items.length === 0 && <div className="empty">예정된 대회가 없어요</div>}</div>
      <p className="note">라이브 랭킹 전광판은 대회 상세에서 열립니다. 결제(토스)·운영자 기록 입력은 2단계.</p>
    </main>
  );
}
