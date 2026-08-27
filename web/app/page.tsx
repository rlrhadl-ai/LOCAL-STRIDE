'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BannerCarousel from '@/components/BannerCarousel';
import LiveBadge from '@/components/LiveBadge';
import { api, mediaUrl } from '@/lib/api';
import type { Course, HomeBanner, NearbyResult, PartnerOffer, Recommendation, RunProgram } from '@/lib/types';

const KMS = [3, 5, 7, 10];
const THEMES = ['수변', '야경', '미식', '역사'];

function PartnerGlyph({ category, featured }: { category: string; featured: boolean }) {
  if (featured) return <svg viewBox="0 0 48 48" fill="none" aria-hidden><path d="M11 32c5-2 7-6 8-13 4 6 8 9 18 10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><path d="M12 35h25" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><circle cx="31" cy="16" r="4" fill="currentColor"/></svg>;
  if (category.includes('카페')) return <svg viewBox="0 0 48 48" fill="none" aria-hidden><path d="M12 17h22v10a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10V17Z" stroke="currentColor" strokeWidth="3"/><path d="M34 21h3a5 5 0 0 1 0 10h-4M17 11c0 2 2 2 2 4M24 11c0 2 2 2 2 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden><path d="M14 13v9a5 5 0 0 0 5 5V37M20 13v24M26 13v9a6 6 0 0 0 6 6V37M32 13v24" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}

export default function Home() {
  const router = useRouter();
  const [km, setKm] = useState(5);
  const [themes, setThemes] = useState<string[]>(['수변', '야경']);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [partners, setPartners] = useState<PartnerOffer[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
  const [programs, setPrograms] = useState<RunProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get<Recommendation>(`/recommend?km=${km}&themes=${encodeURIComponent(themes.join(','))}`)
      .then((r) => { if (!alive) return; setRec(r); setErr(''); })
      .catch(() => alive && setErr('추천 정보를 잠시 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [km, themes]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<{ items: Course[] }>('/courses'),
      api.get<NearbyResult>('/tour/nearby?lat=35.8277&lng=128.6177&radius=5000&limit=12').catch(() => null),
      api.get<{ items: PartnerOffer[] }>('/partners').catch(() => ({ items: [] })),
      api.get<{ items: HomeBanner[] }>('/banners').catch(() => ({ items: [] })),
      api.get<{ items: RunProgram[] }>('/programs?limit=3').catch(() => ({ items: [] })),
    ]).then(([courseResult, nearbyResult, partnerResult, bannerResult, programResult]) => {
      if (!alive) return;
      setCourses(courseResult.items);
      setNearby(nearbyResult);
      setPartners(partnerResult.items);
      setBanners(bannerResult.items);
      setPrograms(programResult.items);
    }).catch(() => alive && setErr('홈 정보를 잠시 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    return () => { alive = false; };
  }, []);

  const wx = rec?.weather;
  const best = rec?.best;
  const attractions = (nearby?.items ?? []).filter((item) => [12, 14, 28].includes(item.contentTypeId)).slice(0, 4);
  const placeKind = (contentTypeId: number) => ({ 12: '관광지', 14: '문화', 28: '레포츠' }[contentTypeId] ?? '로컬 스폿');
  const nextProgram = programs[0];
  const programKind = (kind: RunProgram['kind']) => ({ MORNING: '아침런', AFTER_WORK: '퇴근런', INDEPENDENT: '독립런', THEME: '주제형 러닝', POPUP: '번개런' }[kind]);
  return (
    <main className="page">
      <AppHeader right={<Link href="/me" className="icon-btn" aria-label="마이"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></Link>} />
      <section className="local-hero">
        <div className="local-hero-top"><span>DAEGU BORN · RUNNER CONNECTED</span><b>대구 러너 에디션</b></div>
        <h2>대구 토박이가 고른 길,<br /><em>대구 러너와 달립니다.</em></h2>
        <p>수성못의 아침부터 들안길의 밤까지. 길을 기록하는 데서 멈추지 않고 사람과 동네를 연결해요.</p>
        <div className="local-hero-tags"><span>대구 러너 큐레이션</span><span>러닝 메이트</span><span>완주 후 로컬 혜택</span></div>
      </section>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontSize: 13 }}>{err}</div>}
      <div className="card weather">
        <div>
          <div className="loc">대구광역시 수성구 · 수성못</div>
          <div className="temp">{wx ? `${wx.temp}°C` : '--'}<small>{wx?.sky ?? ''}</small></div>
          <div className="meta">습도 {wx?.humidity ?? '-'}% · 풍속 {wx?.windMs ?? '-'}m/s · 미세먼지 <b>{wx?.pm10Grade ?? '-'}</b> · 일몰 {wx?.sunset ?? '-'}</div>
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}><LiveBadge source={wx?.source} label={wx?.source === 'KMA' ? '기상청' : '기상 시연값'} /><LiveBadge source={wx?.airSource} label={wx?.airSource === 'AIRKOREA' ? '에어코리아' : '대기 시연값'} /></div>
        </div>
        <svg className="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></svg>
      </div>

      <div className="section-title"><h2>오늘의 러닝 조건</h2><span>선택하면 추천이 바뀝니다</span></div>
      <div className="card cond">
        <div className="cond-row"><span className="lbl">거리</span>{KMS.map((k) => <button key={k} type="button" className={`pill ${km === k ? 'on' : ''}`} onClick={() => setKm(k)}>{k}km</button>)}</div>
        <div className="cond-row"><span className="lbl">테마</span>{THEMES.map((t) => <button key={t} type="button" className={`pill ${themes.includes(t) ? 'on' : ''}`} onClick={() => setThemes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}>{t}</button>)}</div>
      </div>

      <div className="section-title"><h2>AI 맞춤 코스 추천</h2><span>추천 이유까지 함께</span></div>
      <div className="ai-card" style={{ opacity: loading ? .7 : 1 }}>
        <div className="ai-top"><span className="ai-badge">✦ AI 추천</span>{best && <span className="ai-score">추천 점수 <b>{best.score}</b></span>}</div>
        <h3>{best?.course.name ?? '추천 계산 중…'}</h3>
        <p className="ai-copy">선택한 러닝 조건과 현재 날씨를 함께 분석했어요.</p>
        {best && <div className="ai-metrics">
          <div><span>거리</span><strong>{(best.course.distanceM / 1000).toFixed(1)}<small>km</small></strong></div>
          <div><span>난이도</span><strong>{best.course.difficulty}</strong></div>
          <div><span>예상 시간</span><strong>{best.course.estMinutes}<small>분</small></strong></div>
        </div>}
        <div className="tags">{best?.course.themes.map((t) => <span key={t} className="tag ghost">{t}</span>)}{best?.course.source === 'USER' && <span className="tag ghost">사용자 코스</span>}</div>
        <div className="reason-box">
          <div className="reasons-head">이 코스를 추천하는 이유</div>
          <ul className="reasons">{best?.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
        </div>
        <button className="btn" type="button" disabled={!best} onClick={() => best && router.push(`/run/${best.course.slug}`)}>이 코스로 러닝 시작</button>
      </div>
      <BannerCarousel items={banners} />

      <section className="local-program-card">
        <div className="local-program-head"><span>DAEGU RUNNING CLUB</span><i aria-hidden>같이</i></div>
        <h2>오늘 대구에서 같이 달릴 사람</h2>
        <p>대구 러너가 길을 안내하고, 혼자 온 러너도 자연스럽게 섞이는 일상 러닝을 준비하고 있어요.</p>
        {nextProgram && <Link href="/programs" className="local-program-next">
          <time><b>{new Date(nextProgram.startsAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</b><span>{new Date(nextProgram.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span></time>
          <div><span>{programKind(nextProgram.kind)} · {nextProgram.host?.nickname || '대구 로컬 호스트'}</span><strong>{nextProgram.title}</strong><small>{nextProgram.place} · 남은 자리 {nextProgram.remaining}명</small></div>
          <b aria-hidden>→</b>
        </Link>}
        <div className="local-program-types"><span>아침런</span><span>퇴근런</span><span>독립런</span><span>주제형 번개런</span></div>
        <div className="local-program-actions"><Link href="/programs">이번 주 일정 보기 <b>→</b></Link><Link href="/mates">러닝 메이트 찾기 <b>→</b></Link></div>
      </section>

      <div className="section-title editorial-title"><div><span className="section-kicker">LOCAL STORY</span><h2>대구 사람들이 달리다 멈추는 곳</h2></div><span>{nearby?.source === 'TOURAPI' ? '관광공사 공공데이터' : '저장 관광지 데이터'}</span></div>
      {attractions.length > 0 ? <div className="spot-scroller">
        {attractions.map((spot) => <article className="spot-card" key={spot.contentId ?? `${spot.title}-${spot.lat}`}>
          <div className="spot-photo">{spot.firstImage ? <img src={spot.firstImage} alt="" /> : <span aria-hidden>LOCAL<br />SPOT</span>}<em>{placeKind(spot.contentTypeId)}</em></div>
          <div className="spot-body"><h3>{spot.title}</h3><p>{spot.overview || spot.addr1 || '러닝 코스 가까이에서 만나는 수성구의 로컬 명소예요.'}</p>{spot.dist != null && <span className="spot-distance">수성못에서 약 {(spot.dist / 1000).toFixed(1)}km</span>}</div>
        </article>)}
      </div> : <div className="card empty-home">주변 관광지를 불러오는 중이에요.</div>}
      <div className="source-row"><LiveBadge source={nearby?.source} ms={nearby?.fetchedMs} label={nearby?.source === 'TOURAPI' ? 'TourAPI' : '저장 관광지'} /><span>위치·이미지는 제공 기관 정보에 따라 달라질 수 있어요.</span></div>

      <div className="section-title editorial-title"><div><span className="section-kicker">AFTER RUN</span><h2>완주 다음, 대구에서 쉬어가기</h2></div><span>러너를 반기는 로컬 파트너</span></div>
      <div className="partner-list">
        {partners.map((partner) => <article className={`partner-card ${partner.status === 'COMING_SOON' ? 'featured' : ''}`} key={partner.id}>
          <div className="partner-icon" aria-hidden>{partner.imageUrl ? <img src={mediaUrl(partner.imageUrl)} alt="" /> : <PartnerGlyph category={partner.category} featured={partner.status === 'COMING_SOON'} />}</div>
          <div className="partner-body">
            <div className="partner-line"><span>{partner.category}</span><em>{partner.status === 'COMING_SOON' ? '제휴 준비 중' : partner.status === 'ACTIVE' ? '완주 혜택' : '시연 혜택'}</em></div>
            <h3>{partner.name}</h3>
            <strong>{partner.offerTitle}</strong>
            {partner.addr && <p>{partner.addr}</p>}
            <div className="partner-foot"><span>DAEGU LOCAL</span><b>{partner.status === 'COMING_SOON' ? '러너 라운지 준비 중' : '완주 후 이용'} →</b></div>
          </div>
        </article>)}
        {partners.length === 0 && <div className="card empty-home">로컬 파트너 혜택을 준비하고 있어요.</div>}
      </div>
      <p className="benefit-note">러너스테이의 할인율은 제휴 확정 후 공개됩니다. 시연 혜택은 실제 사용 전 매장 확인이 필요해요.</p>

      <div className="section-title editorial-title"><div><span className="section-kicker">DAEGU ROUTE EDIT</span><h2>토박이 러너의 대구 코스</h2></div><Link href="/courses/new">+ 내 코스 만들기</Link></div>
      <div className="course-list">
        {courses.map((c, i) => (
          <Link className="course editorial-course" href={`/courses/${c.slug}`} key={c.id}>
            <div className={`thumb ${c.source === 'USER' ? 'user' : `t${i % 4}`}`}>
              {c.thumbnailUrl && <img src={mediaUrl(c.thumbnailUrl)} alt="" />}
              <span className="course-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="course-distance">{(c.distanceM / 1000).toFixed(1)}K</span>
            </div>
            <div className="course-copy">
              <span className="course-area">{c.areaName || '대구광역시'} · {c.source === 'USER' ? '러너 제작' : '로컬 큐레이션'}</span>
              <h4>{c.name}</h4>
              <p className="course-description">{c.description || '대구의 시간과 풍경을 가장 가까이에서 만나는 러닝 코스예요.'}</p>
              <div className="course-tags"><span>{c.difficulty}</span>{c.themes.slice(0, 2).map((theme) => <span key={theme}>{theme}</span>)}{best?.course.id === c.id && <b>AI PICK</b>}</div>
            </div>
            <span className="course-arrow" aria-hidden>→</span>
          </Link>
        ))}
      </div>
      <p className="note">코스·관광지 데이터는 한국관광공사 TourAPI 4.0 형식으로 저장·갱신됩니다. LIVE 배지가 붙은 값은 지금 API에서 받아온 실데이터입니다.</p>
    </main>
  );
}
