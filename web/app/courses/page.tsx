'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api } from '@/lib/api';
import type { Course } from '@/lib/types';

const THEMES = ['전체', '수변', '야경', '미식', '역사', '골목'];
export default function CoursesPage() {
  const [theme, setTheme] = useState('전체');
  const [items, setItems] = useState<Course[]>([]);
  useEffect(() => { api.get<{ items: Course[] }>(`/courses${theme === '전체' ? '' : `?theme=${encodeURIComponent(theme)}`}`).then((r) => setItems(r.items)).catch(() => setItems([])); }, [theme]);
  return (
    <main className="page">
      <AppHeader title="코스" right={<Link href="/courses/new" className="btn sm">+ 만들기</Link>} />
      <div className="pills" style={{ marginBottom: 12 }}>{THEMES.map((t) => <button key={t} type="button" className={`pill ${theme === t ? 'on' : ''}`} onClick={() => setTheme(t)}>{t}</button>)}</div>
      <div className="course-list">
        {items.map((c, i) => (
          <div className="course" key={c.id}>
            <div className={`thumb ${c.source === 'USER' ? 'user' : `t${i % 4}`}`} />
            <div><h4>{c.name}</h4><p>{(c.distanceM / 1000).toFixed(1)}km · {c.difficulty} · 체크포인트 {c._count?.checkpoints ?? '-'} · 완주 {c._count?.runs ?? 0}회</p></div>
            <Link className="go" href={`/courses/${c.slug}`}>보기</Link>
          </div>
        ))}
        {items.length === 0 && <div className="empty">해당 테마의 코스가 아직 없어요. 직접 만들어 보세요.</div>}
      </div>
    </main>
  );
}
