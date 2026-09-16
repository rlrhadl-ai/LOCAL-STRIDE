'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { adminJson, adminRequest } from '@/lib/admin-api';
import { API_URL } from '@/lib/api';
import { HAZARD_CATEGORY, HAZARD_STATUS, HAZARD_SEVERITY, hazardPhotoUrl, type Hazard, type HazardHistory } from '@/lib/hazards';

const LocationMap = dynamic(() => import('./HazardLocationMap'), { ssr: false });
const emptyRoute: [number, number][] = [];
type Results = { items: Hazard[]; total: number; page: number; pageSize: number; counts: Partial<Record<Hazard['status'], number>>; courses: { id: string; name: string }[] };
type Detail = Hazard & { history: HazardHistory[] };

export default function AdminHazards() {
  const [status, setStatus] = useState(''), [category, setCategory] = useState(''), [courseId, setCourseId] = useState(''), [page, setPage] = useState(1);
  const [data, setData] = useState<Results | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0), [detail, setDetail] = useState<Detail | null>(null), [detailLoading, setDetailLoading] = useState(false);
  const [nextStatus, setNextStatus] = useState<Hazard['status']>('RECEIVED'), [note, setNote] = useState(''), [publicNote, setPublicNote] = useState('');
  const [saving, setSaving] = useState(false), [exporting, setExporting] = useState(false), [message, setMessage] = useState('');
  const selection = useRef(0), savingRef = useRef(false);
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(category ? { category } : {}), ...(courseId ? { courseId } : {}) }).toString();
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    adminRequest<Results>(`/hazards?${query}&page=${page}`, { signal: controller.signal }).then(setData).catch((e) => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, page, refresh]);
  useEffect(() => () => { selection.current++; }, []);
  async function inspect(id: string) {
    const ticket = ++selection.current; setDetail(null); setDetailLoading(true); setError('');
    try {
      const result = await adminRequest<Detail>(`/hazards/${id}`);
      if (selection.current !== ticket) return;
      setDetail(result); setNextStatus(result.status); setNote(''); setPublicNote(result.publicNote);
    } catch (e) { if (selection.current === ticket) setError(e instanceof Error ? e.message : '신고를 불러오지 못했습니다'); }
    finally { if (selection.current === ticket) setDetailLoading(false); }
  }
  async function save() {
    if (!detail || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(''); setMessage('');
    try {
      await adminJson(`/hazards/${detail.id}`, 'PATCH', { version: detail.version, status: nextStatus, note, publicNote });
      setMessage('처리 상태와 이력을 저장했습니다. 해결·비공개 신고는 공개 지도에서 제외됩니다.');
      await inspect(detail.id); setRefresh((n) => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : '저장하지 못했습니다'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function exportCsv() {
    setExporting(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/admin/hazards/export?${query}`, { credentials: 'include' });
      if (!res.ok) { const body = await res.json().catch(() => null); throw new Error(body?.error || '다운로드하지 못했습니다'); }
      const url = URL.createObjectURL(await res.blob()), a = document.createElement('a');
      a.href = url; a.download = `localstride-hazards-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : '다운로드 실패'); }
    finally { setExporting(false); }
  }
  return <div className="admin-hazards">
    <p>사진·좌표 기반 코스 신고를 확인합니다. ‘확인 완료’ 이후 사진·설명이 공개됩니다.</p>
    <div className="hazard-admin-stats" aria-label="전체 신고 상태 통계">{Object.entries(HAZARD_STATUS).map(([v, label]) => <div key={v}><span>{label}</span><b>{data?.counts[v as Hazard['status']] ?? 0}</b></div>)}</div>
    <div className="hazard-admin-filters">
      <label>상태<select aria-label="상태" className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">전체 상태</option>{Object.entries(HAZARD_STATUS).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label>
      <label>유형<select className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">전체 유형</option>{Object.entries(HAZARD_CATEGORY).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label>
      <label>코스<select className="input" value={courseId} onChange={(e) => { setCourseId(e.target.value); setPage(1); }}><option value="">전체 코스</option>{data?.courses.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
      <button type="button" className="btn light sm" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>새로고침</button>
      <button type="button" className="btn gold sm" disabled={exporting} onClick={exportCsv}>{exporting ? '내려받는 중…' : '필터 결과 CSV'}</button>
    </div>
    {error && <p className="admin-error-box" role="alert">{error}</p>}{message && <p className="admin-notice" role="status">{message}</p>}
    {detailLoading && <p role="status">신고 상세를 불러오는 중…</p>}
    {detail && <section className="hazard-admin-detail" aria-label="신고 상세 및 처리">
      <div className="hazard-heading"><h2>{HAZARD_CATEGORY[detail.category]} · {detail.course.name}</h2><button type="button" className="btn light sm" disabled={saving} onClick={() => { selection.current++; setDetail(null); }}>닫기</button></div>
      <div className="hazard-admin-evidence"><img src={hazardPhotoUrl(detail.id)} alt="관리자 검토용 신고 사진" /><div className="hazard-map"><LocationMap route={emptyRoute} point={[detail.lat, detail.lng]} /></div></div>
      <p>{detail.description}</p><p className="note">{HAZARD_SEVERITY[detail.severity]} · {detail.locationSource === 'GPS' ? `GPS (오차 약 ${Math.round(detail.accuracyM ?? 0)}m)` : '이용자가 지도에서 선택'} · {detail.lat.toFixed(6)}, {detail.lng.toFixed(6)}<br />접수 {new Date(detail.createdAt).toLocaleString('ko-KR')} · 신고번호 {detail.id}</p>
      <p className="note">사진의 얼굴·번호판·개인정보와 실제 위험 상황을 검토한 뒤 공개 상태를 선택해 주세요. 위치와 내용은 이용자 제보입니다.</p>
      <fieldset disabled={saving}><legend>처리 결과</legend><label className="field">처리 상태<select aria-label="처리 상태" className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as Hazard['status'])}>{Object.entries(HAZARD_STATUS).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</select></label>
        <label className="field">이용자에게 공개할 처리 안내 (선택)<textarea className="input" maxLength={300} rows={2} value={publicNote} onChange={(e) => setPublicNote(e.target.value)} placeholder="예: 데크 진입 구간을 우회해 주세요." /></label>
        <label className="field">관리자 내부 처리 메모 (필수)<textarea className="input" minLength={2} maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="확인 내용 또는 상태 변경 이유" /></label>
        <div className="hazard-actions"><button type="button" className="btn light" onClick={() => inspect(detail.id)}>상세 다시 불러오기</button><button type="button" className="btn gold" disabled={note.trim().length < 2} onClick={save}>{saving ? '저장 중…' : '처리 결과 저장'}</button></div>
      </fieldset>
      <h3>처리 이력</h3>{!detail.history.length && <p className="note">아직 처리 이력이 없습니다.</p>}<ol className="hazard-history">{detail.history.map((h) => <li key={h.id}><b>{HAZARD_STATUS[h.status]}</b> · {h.admin.nickname} · {new Date(h.createdAt).toLocaleString('ko-KR')}<p>{h.note}</p></li>)}</ol>
    </section>}
    <p role="status">{loading ? '신고 목록을 불러오는 중…' : `검색 결과 ${data?.total ?? 0}건 (최신 접수 순)`}</p>
    <div className="hazard-admin-table"><table><thead><tr><th>접수일</th><th>코스 / 지역</th><th>유형</th><th>위험도</th><th>상태</th><th>확인</th></tr></thead><tbody>{!loading && data?.items.map((r) => <tr key={r.id}><td>{new Date(r.createdAt).toLocaleString('ko-KR')}</td><td>{r.course.name}<small>{r.course.areaName}</small></td><td>{HAZARD_CATEGORY[r.category]}</td><td>{HAZARD_SEVERITY[r.severity]}</td><td><span className={`hazard-badge ${r.status}`}>{HAZARD_STATUS[r.status]}</span></td><td><button type="button" className="btn light sm" disabled={saving} onClick={() => inspect(r.id)}>상세·처리</button></td></tr>)}</tbody></table></div>
    {!loading && data?.total === 0 && <p className="empty">조건에 맞는 신고가 없습니다.</p>}
    <div className="hazard-pagination"><button type="button" className="btn light sm" disabled={loading || page === 1} onClick={() => setPage((n) => n - 1)}>이전</button><span>{page} / {Math.max(1, Math.ceil((data?.total ?? 0) / 25))}</span><button type="button" className="btn light sm" disabled={loading || page * 25 >= (data?.total ?? 0)} onClick={() => setPage((n) => n + 1)}>다음</button></div>
  </div>;
}
