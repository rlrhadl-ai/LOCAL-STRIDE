'use client';
import { useState } from 'react';
import HazardReportForm from './HazardReportForm';
import { HAZARD_CATEGORY, HAZARD_SEVERITY, HAZARD_STATUS, hazardPhotoUrl, type useHazards } from '@/lib/hazards';
import type { Course } from '@/lib/types';

export default function CourseHazards({ course, feed, onReportStart }: { course: Course; feed: ReturnType<typeof useHazards>; onReportStart?: () => void }) {
  const [open, setOpen] = useState(false), [message, setMessage] = useState('');
  return <section className="course-hazards" aria-labelledby="hazard-heading">
    <div className="hazard-heading"><div><span>함께 지키는 러닝 코스</span><h2 id="hazard-heading">코스 안전 제보</h2></div>{!open && <button type="button" className="btn gold sm" onClick={() => { onReportStart?.(); setOpen(true); }}>사진으로 신고</button>}</div>
    <p className="note">지도에서 노란 점은 확인 전, 빨간 점은 운영자가 확인한 미해결 신고입니다. 1분마다 새로 확인합니다.</p>
    {message && <p className="hazard-success" role="status">{message}</p>}
    {open && <HazardReportForm course={course} onCancel={() => setOpen(false)} onSubmitted={(id) => { setOpen(false); setMessage(`신고를 접수했어요 (${id.slice(-6)}). 지도에 확인 전 지점으로 표시됩니다.`); void feed.refresh(); }} />}
    <div className="hazard-list-heading"><b>미해결 신고 {feed.error ? '확인 필요' : `${feed.total}건`}</b><button type="button" disabled={feed.loading} onClick={feed.refresh}>새로고침</button></div>
    {feed.error ? <p className="hazard-error" role="alert">현황을 확인하지 못했어요. {feed.error} 새로고침해 주세요.</p> : feed.loading && feed.items.length === 0 ? <p role="status">신고 현황을 불러오는 중…</p> : !feed.total && <p className="note">현재 접수된 미해결 신고가 없습니다. 현장의 안전 상태는 직접 확인해 주세요.</p>}
    <div className="hazard-list">{feed.items.map((r) => <details key={r.id} className="hazard-item"><summary><span><b>{HAZARD_CATEGORY[r.category]}</b><small>{new Date(r.createdAt).toLocaleDateString('ko-KR')} · {HAZARD_SEVERITY[r.severity]}</small></span><span className={`hazard-badge ${r.status}`}>{HAZARD_STATUS[r.status]}</span></summary><p>{r.description || '운영자가 내용을 확인하고 있어요. 확인 전 사진과 설명은 공개되지 않습니다.'}</p><p className="note">위치 {r.lat.toFixed(5)}, {r.lng.toFixed(5)}</p>{r.photoUrl && <img className="hazard-preview" src={hazardPhotoUrl(r.id)} alt={`${HAZARD_CATEGORY[r.category]} 현장 사진`} loading="lazy" />}{r.publicNote && <p>처리 안내: {r.publicNote}</p>}</details>)}</div>
    {feed.items.length < feed.total && <button type="button" className="btn light" disabled={feed.loading} onClick={feed.loadMore}>신고 더 보기 ({feed.items.length}/{feed.total})</button>}
  </section>;
}
