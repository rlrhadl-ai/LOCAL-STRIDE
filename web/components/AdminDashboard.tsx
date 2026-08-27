'use client';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminJson, adminRequest, uploadAdminImage } from '@/lib/admin-api';
import { mediaUrl } from '@/lib/api';

type Panel = 'dashboard' | 'banners' | 'courses' | 'pois' | 'partners' | 'users';
type Row = Record<string, any>;

const NAV: { id: Panel; label: string }[] = [
  { id: 'dashboard', label: '대시보드' }, { id: 'banners', label: '광고 배너' }, { id: 'courses', label: '코스' },
  { id: 'pois', label: '관광지' }, { id: 'partners', label: '혜택·파트너' }, { id: 'users', label: '회원' },
];
const TITLES: Record<Panel, string> = { dashboard: '운영 현황', banners: '홈 광고 배너', courses: '러닝 코스', pois: '관광지 콘텐츠', partners: '로컬 혜택·파트너', users: '회원 관리' };
const ENDPOINT: Partial<Record<Panel, string>> = { banners: '/banners', courses: '/courses', pois: '/pois', partners: '/partners', users: '/users' };
const CREATE_ALLOWED: Panel[] = ['banners', 'pois', 'partners'];

const blank = (panel: Panel): Row => panel === 'banners' ? { title: '', subtitle: '', imageUrl: '', linkUrl: '', sortOrder: 0, isActive: true, startsAt: '', endsAt: '' }
  : panel === 'pois' ? { contentId: '', contentTypeId: 12, title: '', addr1: '', lat: 35.8277, lng: 128.6177, firstImage: '', tel: '', overview: '' }
  : panel === 'partners' ? { name: '', category: '', addr: '', offerTitle: '', discountKrw: '', validUntil: '', status: 'COMING_SOON', imageUrl: '', sortOrder: 0 }
  : {};

const localDate = (value?: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';
const nullable = (value: unknown) => value === '' || value == null ? null : value;
const nullableIsoDate = (value: unknown) => value === '' || value == null ? null : new Date(String(value)).toISOString();

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`admin-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>;
}

function ImageField({ label, value, onChange, onError }: { label: string; value: string; onChange: (value: string) => void; onError: (message: string) => void }) {
  const [uploading, setUploading] = useState(false);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const result = await uploadAdminImage(file); onChange(result.url); }
    catch (error) { onError(error instanceof Error ? error.message : '이미지 업로드에 실패했습니다'); }
    finally { setUploading(false); event.target.value = ''; }
  }
  return <Field label={label} wide><div className="admin-image-field">
    <div className="admin-image-preview">{value ? <img src={mediaUrl(value)} alt="선택한 이미지 미리보기" /> : <span>이미지 없음</span>}</div>
    <div className="admin-image-controls"><input className="input" value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://… 또는 업로드 경로" /><label className="btn light sm">{uploading ? '업로드 중…' : '파일 업로드'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={upload} disabled={uploading} hidden /></label></div>
  </div></Field>;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<Row | null>(null);
  const [panel, setPanel] = useState<Panel>('dashboard');
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Row | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    adminRequest<{ user: Row }>('/auth/session').then((result) => setUser(result.user)).catch(() => router.replace('/admin/login'));
  }, [router]);

  async function load(target: Panel = panel) {
    setLoading(true); setError('');
    try {
      if (target === 'dashboard') setStats(await adminRequest('/dashboard'));
      else setRows((await adminRequest<{ items: Row[] }>(ENDPOINT[target]!)).items);
    } catch (err) { if ((err as any)?.status === 401) router.replace('/admin/login'); else setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (user) { setEditing(null); load(panel); } }, [panel, user]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(row: Row) {
    setMessage(''); setError('');
    setEditing({ ...row, themes: Array.isArray(row.themes) ? row.themes.join(', ') : row.themes, startsAt: localDate(row.startsAt), endsAt: localDate(row.endsAt), validUntil: localDate(row.validUntil) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function change(key: string, value: unknown) { setEditing((current) => current ? { ...current, [key]: value } : current); }

  function payload() {
    const item = editing!;
    if (panel === 'banners') return { title: item.title, subtitle: nullable(item.subtitle), imageUrl: item.imageUrl, linkUrl: nullable(item.linkUrl), sortOrder: Number(item.sortOrder), isActive: Boolean(item.isActive), startsAt: nullableIsoDate(item.startsAt), endsAt: nullableIsoDate(item.endsAt) };
    if (panel === 'courses') return { name: item.name, description: item.description, thumbnailUrl: nullable(item.thumbnailUrl), difficulty: item.difficulty, themes: String(item.themes).split(',').map((value) => value.trim()).filter(Boolean), areaName: item.areaName, estMinutes: Number(item.estMinutes), elevationGainM: Number(item.elevationGainM), isPublic: Boolean(item.isPublic) };
    if (panel === 'pois') return { contentId: nullable(item.contentId), contentTypeId: Number(item.contentTypeId), title: item.title, addr1: nullable(item.addr1), lat: Number(item.lat), lng: Number(item.lng), firstImage: nullable(item.firstImage), tel: nullable(item.tel), overview: nullable(item.overview) };
    if (panel === 'partners') return { name: item.name, category: item.category, addr: nullable(item.addr), offerTitle: item.offerTitle, discountKrw: item.discountKrw === '' ? null : Number(item.discountKrw), validUntil: nullableIsoDate(item.validUntil), status: item.status, imageUrl: nullable(item.imageUrl), sortOrder: Number(item.sortOrder) };
    return { nickname: item.nickname, isActive: Boolean(item.isActive), avatarColor: item.avatarColor, avatarUrl: nullable(item.avatarUrl), bio: nullable(item.bio), homeArea: item.homeArea, weeklyGoalKm: Number(item.weeklyGoalKm), preferredPaceSec: item.preferredPaceSec === '' || item.preferredPaceSec == null ? null : Number(item.preferredPaceSec) };
  }

  async function save(event: FormEvent) {
    event.preventDefault(); if (!editing) return; setSaving(true); setError(''); setMessage('');
    try {
      const endpoint = ENDPOINT[panel]!; const exists = Boolean(editing.id);
      await adminJson(exists ? `${endpoint}/${editing.id}` : endpoint, exists ? 'PATCH' : 'POST', payload());
      setEditing(null); setMessage('저장했습니다.'); await load(panel);
    } catch (err) { setError(err instanceof Error ? err.message : '저장하지 못했습니다'); }
    finally { setSaving(false); }
  }

  async function remove(row: Row) {
    if (!window.confirm(`‘${row.title || row.name}’ 항목을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    try { await adminRequest(`${ENDPOINT[panel]}/${row.id}`, { method: 'DELETE' }); setMessage('삭제했습니다.'); await load(panel); }
    catch (err) { setError(err instanceof Error ? err.message : '삭제하지 못했습니다'); }
  }

  async function logout() { await adminRequest('/auth/logout', { method: 'POST' }).catch(() => undefined); router.replace('/login?next=/admin'); }

  return <main className="admin-page">
    <header className="admin-topbar"><Link href="/" className="admin-logo"><img src="/logo-white.png" alt="LOCAL STRIDE" /><span>ADMIN</span></Link><div><span>{user?.email}</span><Link href="/me" className="admin-top-link">내 프로필</Link><Link href="/" className="admin-top-link">서비스 보기</Link><button type="button" onClick={logout}>로그아웃</button></div></header>
    <div className="admin-layout">
      <aside className="admin-sidebar"><p>운영 메뉴</p>{NAV.map((item) => <button type="button" key={item.id} className={panel === item.id ? 'on' : ''} onClick={() => setPanel(item.id)}>{item.label}</button>)}</aside>
      <section className="admin-content">
        <div className="admin-heading"><div><span>LOCAL STRIDE MANAGEMENT</span><h1>{TITLES[panel]}</h1></div>{CREATE_ALLOWED.includes(panel) && !editing && <button type="button" className="btn sm" onClick={() => setEditing(blank(panel))}>+ 새 항목</button>}{panel === 'courses' && <Link className="btn sm" href="/courses/new">+ 코스 그리기</Link>}</div>
        {message && <div className="admin-notice">{message}</div>}{error && <div className="admin-error-box" role="alert">{error}</div>}
        {editing && <form className="admin-editor" onSubmit={save}><div className="admin-editor-head"><h2>{editing.id ? '항목 편집' : '새 항목 만들기'}</h2><button type="button" onClick={() => setEditing(null)}>닫기 ×</button></div><div className="admin-form-grid">{renderForm(panel, editing, change, setError)}</div><div className="admin-editor-actions"><button type="button" className="btn light sm" onClick={() => setEditing(null)}>취소</button><button className="btn sm" disabled={saving}>{saving ? '저장 중…' : '저장'}</button></div></form>}
        {panel === 'dashboard' ? <Dashboard stats={stats} loading={loading} /> : <DataList panel={panel} rows={rows} loading={loading} onEdit={startEdit} onDelete={remove} />}
      </section>
    </div>
  </main>;
}

function renderForm(panel: Panel, item: Row, change: (key: string, value: unknown) => void, onError: (message: string) => void) {
  if (panel === 'banners') return <><Field label="배너 제목" wide><input className="input" value={item.title} onChange={(e) => change('title', e.target.value)} required /></Field><Field label="보조 문구" wide><input className="input" value={item.subtitle || ''} onChange={(e) => change('subtitle', e.target.value)} /></Field><ImageField label="배너 이미지" value={item.imageUrl || ''} onChange={(value) => change('imageUrl', value)} onError={onError} /><Field label="클릭 이동 경로"><input className="input" value={item.linkUrl || ''} onChange={(e) => change('linkUrl', e.target.value)} placeholder="/courses/… 또는 https://…" /></Field><Field label="노출 순서"><input className="input" type="number" min="0" value={item.sortOrder} onChange={(e) => change('sortOrder', e.target.value)} /></Field><Field label="노출 시작"><input className="input" type="datetime-local" value={item.startsAt || ''} onChange={(e) => change('startsAt', e.target.value)} /></Field><Field label="노출 종료"><input className="input" type="datetime-local" value={item.endsAt || ''} onChange={(e) => change('endsAt', e.target.value)} /></Field><Field label="상태"><label className="admin-check"><input type="checkbox" checked={Boolean(item.isActive)} onChange={(e) => change('isActive', e.target.checked)} /> 홈에 노출</label></Field></>;
  if (panel === 'courses') return <><Field label="코스명" wide><input className="input" value={item.name} onChange={(e) => change('name', e.target.value)} required /></Field><Field label="설명" wide><textarea className="input" rows={4} value={item.description || ''} onChange={(e) => change('description', e.target.value)} /></Field><ImageField label="코스 썸네일" value={item.thumbnailUrl || ''} onChange={(value) => change('thumbnailUrl', value)} onError={onError} /><Field label="난이도"><select className="input" value={item.difficulty} onChange={(e) => change('difficulty', e.target.value)}><option>초급</option><option>초중급</option><option>중급</option><option>상급</option></select></Field><Field label="테마"><input className="input" value={item.themes || ''} onChange={(e) => change('themes', e.target.value)} placeholder="수변, 야경" /></Field><Field label="지역"><input className="input" value={item.areaName || ''} onChange={(e) => change('areaName', e.target.value)} /></Field><Field label="예상 시간(분)"><input className="input" type="number" min="1" value={item.estMinutes} onChange={(e) => change('estMinutes', e.target.value)} /></Field><Field label="누적 상승고도(m)"><input className="input" type="number" min="0" value={item.elevationGainM} onChange={(e) => change('elevationGainM', e.target.value)} /></Field><Field label="공개 상태"><label className="admin-check"><input type="checkbox" checked={Boolean(item.isPublic)} onChange={(e) => change('isPublic', e.target.checked)} /> 사용자에게 공개</label></Field></>;
  if (panel === 'pois') return <><Field label="관광지명" wide><input className="input" value={item.title} onChange={(e) => change('title', e.target.value)} required /></Field><Field label="TourAPI 콘텐츠 ID"><input className="input" value={item.contentId || ''} onChange={(e) => change('contentId', e.target.value)} /></Field><Field label="유형 코드"><input className="input" type="number" value={item.contentTypeId} onChange={(e) => change('contentTypeId', e.target.value)} /></Field><ImageField label="관광지 썸네일" value={item.firstImage || ''} onChange={(value) => change('firstImage', value)} onError={onError} /><Field label="주소" wide><input className="input" value={item.addr1 || ''} onChange={(e) => change('addr1', e.target.value)} /></Field><Field label="위도"><input className="input" type="number" step="any" value={item.lat} onChange={(e) => change('lat', e.target.value)} required /></Field><Field label="경도"><input className="input" type="number" step="any" value={item.lng} onChange={(e) => change('lng', e.target.value)} required /></Field><Field label="전화번호"><input className="input" value={item.tel || ''} onChange={(e) => change('tel', e.target.value)} /></Field><Field label="소개" wide><textarea className="input" rows={5} value={item.overview || ''} onChange={(e) => change('overview', e.target.value)} /></Field></>;
  if (panel === 'partners') return <><Field label="파트너명"><input className="input" value={item.name} onChange={(e) => change('name', e.target.value)} required /></Field><Field label="업종"><input className="input" value={item.category} onChange={(e) => change('category', e.target.value)} required /></Field><ImageField label="로고·썸네일" value={item.imageUrl || ''} onChange={(value) => change('imageUrl', value)} onError={onError} /><Field label="혜택 문구" wide><input className="input" value={item.offerTitle} onChange={(e) => change('offerTitle', e.target.value)} required /></Field><Field label="주소" wide><input className="input" value={item.addr || ''} onChange={(e) => change('addr', e.target.value)} /></Field><Field label="정액 할인(원)"><input className="input" type="number" min="0" value={item.discountKrw ?? ''} onChange={(e) => change('discountKrw', e.target.value)} /></Field><Field label="유효 기간"><input className="input" type="datetime-local" value={item.validUntil || ''} onChange={(e) => change('validUntil', e.target.value)} /></Field><Field label="상태"><select className="input" value={item.status} onChange={(e) => change('status', e.target.value)}><option value="COMING_SOON">제휴 준비 중</option><option value="ACTIVE">완주 혜택</option><option value="DEMO">시연 혜택</option><option value="HIDDEN">숨김</option></select></Field><Field label="노출 순서"><input className="input" type="number" min="0" value={item.sortOrder} onChange={(e) => change('sortOrder', e.target.value)} /></Field></>;
  return <><Field label="닉네임"><input className="input" value={item.nickname} onChange={(e) => change('nickname', e.target.value)} required /></Field><Field label="이메일"><input className="input" value={item.email || '익명 기기 회원'} readOnly /></Field><Field label="권한"><input className="input" value={item.role} readOnly /></Field><Field label="활동 지역"><input className="input" value={item.homeArea || ''} onChange={(e) => change('homeArea', e.target.value)} /></Field><Field label="한 줄 소개" wide><textarea className="input" rows={3} value={item.bio || ''} onChange={(e) => change('bio', e.target.value)} maxLength={160} /></Field><Field label="프로필 이미지 URL" wide><input className="input" value={item.avatarUrl || ''} onChange={(e) => change('avatarUrl', e.target.value)} placeholder="https://…" /></Field><Field label="프로필 컬러"><input className="input" type="color" value={item.avatarColor || '#1B5BDF'} onChange={(e) => change('avatarColor', e.target.value)} /></Field><Field label="주간 목표(km)"><input className="input" type="number" min="1" max="500" value={item.weeklyGoalKm || 20} onChange={(e) => change('weeklyGoalKm', e.target.value)} /></Field><Field label="선호 페이스(초/km)"><input className="input" type="number" min="180" max="900" value={item.preferredPaceSec ?? ''} onChange={(e) => change('preferredPaceSec', e.target.value)} placeholder="예: 390" /></Field><Field label="계정 상태"><label className="admin-check"><input type="checkbox" checked={Boolean(item.isActive)} onChange={(e) => change('isActive', e.target.checked)} /> 활성 계정</label></Field></>;
}

function Dashboard({ stats, loading }: { stats: Row | null; loading: boolean }) {
  if (loading || !stats) return <div className="admin-loading">운영 데이터를 불러오는 중…</div>;
  const labels: Record<string, string> = { users: '전체 회원', courses: '코스', pois: '관광지', partners: '파트너', banners: '배너', runs: '러닝 기록' };
  return <><div className="admin-stats">{Object.entries(stats.counts).map(([key, value]) => <article key={key}><span>{labels[key]}</span><strong>{String(value)}</strong></article>)}</div><section className="admin-panel"><h2>최근 가입 회원</h2><div className="admin-table">{stats.recentUsers.map((item: Row) => <div className="admin-table-row" key={item.id}><div><strong>{item.nickname}</strong><span>{item.email || '익명 기기 회원'}</span></div><em>{item.role === 'ADMIN' ? '관리자' : '회원'}</em><time>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</time></div>)}</div></section></>;
}

function DataList({ panel, rows, loading, onEdit, onDelete }: { panel: Panel; rows: Row[]; loading: boolean; onEdit: (row: Row) => void; onDelete: (row: Row) => void }) {
  if (loading) return <div className="admin-loading">데이터를 불러오는 중…</div>;
  if (!rows.length) return <div className="admin-empty">등록된 항목이 없습니다.</div>;
  return <div className="admin-data-list">{rows.map((row) => {
    const image = row.imageUrl || row.thumbnailUrl || row.firstImage || row.avatarUrl; const title = row.title || row.name || row.nickname;
    const sub = panel === 'banners' ? `${row.isActive ? '노출 중' : '숨김'} · 순서 ${row.sortOrder}` : panel === 'courses' ? `${(row.distanceM / 1000).toFixed(1)}km · ${row.difficulty} · ${row.isPublic ? '공개' : '비공개'}` : panel === 'pois' ? `${row.addr1 || '주소 없음'} · ${row.source}` : panel === 'partners' ? `${row.category} · ${row.status}` : `${row.email || '익명 기기 회원'} · 러닝 ${row._count?.runs || 0}회`;
    return <article className="admin-data-card" key={row.id}><div className="admin-data-thumb">{image ? <img src={mediaUrl(image)} alt="" /> : <span>{String(title).slice(0, 1)}</span>}</div><div className="admin-data-copy"><strong>{title}</strong><span>{sub}</span>{(row.subtitle || row.offerTitle) && <p>{row.subtitle || row.offerTitle}</p>}</div><div className="admin-data-actions"><button type="button" onClick={() => onEdit(row)}>편집</button>{panel !== 'users' && <button type="button" className="danger" onClick={() => onDelete(row)}>삭제</button>}</div></article>;
  })}</div>;
}
