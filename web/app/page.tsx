'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import BannerCarousel from '@/components/BannerCarousel';
import LiveBadge from '@/components/LiveBadge';
import { api, mediaUrl } from '@/lib/api';
import type { Course, HomeBanner, NearbyResult, PartnerOffer, Recommendation } from '@/lib/types';

const KMS = [3, 5, 7, 10];
const THEMES = ['수변', '야경', '미식', '역사'];

export default function Home() {
  const router = useRouter();
  const [km, setKm] = useState(5);
  const [themes, setThemes] = useState<string[]>(['수변', '야경']);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [nearby, setNearby] = useState<NearbyResult | null>(null);
  const [partners, setPartners] = useState<PartnerOffer[]>([]);
  const [banners, setBanners] = useState<HomeBanner[]>([]);
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
    ]).then(([courseResult, nearbyResult, partnerResult, bannerResult]) => {
      if (!alive) return;
      setCourses(courseResult.items);
      setNearby(nearbyResult);
      setPartners(partnerResult.items);
      setBanners(bannerResult.items);
    }).catch(() => alive && setErr('홈 정보를 잠시 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    return () => { alive = false; };
  }, []);

  const wx = rec?.weather;
  const best = rec?.best;
  const attractions = (nearby?.items ?? []).filter((item) => [12, 14, 28].includes(item.contentTypeId)).slice(0, 4);
  const placeKind = (contentTypeId: number) => ({ 12: '관광지', 14: '문화', 28: '레포츠' }[contentTypeId] ?? '로컬 스폿');
  return (
    <main className="page">
      <AppHeader right={<Link href="/me" className="icon-btn" aria-label="마이"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg></Link>} />
      <p className="greet">안녕하세요, 러너님! 👋 오늘도 멋진 러닝 되세요!</p>
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

      <div className="section-title"><h2>달리며 만나는 수성구</h2><span>{nearby?.source === 'TOURAPI' ? '관광공사 공공데이터' : '저장 관광지 데이터'}</span></div>
      {attractions.length > 0 ? <div className="spot-scroller">
        {attractions.map((spot) => <article className="spot-card" key={spot.contentId ?? `${spot.title}-${spot.lat}`}>
          <div className="spot-photo">{spot.firstImage ? <img src={spot.firstImage} alt="" /> : <span aria-hidden>LOCAL<br />SPOT</span>}<em>{placeKind(spot.contentTypeId)}</em></div>
          <div className="spot-body"><h3>{spot.title}</h3><p>{spot.overview || spot.addr1 || '러닝 코스 가까이에서 만나는 수성구의 로컬 명소예요.'}</p>{spot.dist != null && <span className="spot-distance">수성못에서 약 {(spot.dist / 1000).toFixed(1)}km</span>}</div>
        </article>)}
      </div> : <div className="card empty-home">주변 관광지를 불러오는 중이에요.</div>}
      <div className="source-row"><LiveBadge source={nearby?.source} ms={nearby?.fetchedMs} label={nearby?.source === 'TOURAPI' ? 'TourAPI' : '저장 관광지'} /><span>위치·이미지는 제공 기관 정보에 따라 달라질 수 있어요.</span></div>

      <div className="section-title"><h2>러닝 후 누리는 로컬 혜택</h2><span>완주 리워드 파트너</span></div>
      <div className="partner-list">
        {partners.map((partner) => <article className={`partner-card ${partner.status === 'COMING_SOON' ? 'featured' : ''}`} key={partner.id}>
          <div className="partner-icon" aria-hidden>{partner.imageUrl ? <img src={mediaUrl(partner.imageUrl)} alt="" /> : partner.status === 'COMING_SOON' ? 'R' : '₩'}</div>
          <div className="partner-body">
            <div className="partner-line"><span>{partner.category}</span><em>{partner.status === 'COMING_SOON' ? '제휴 준비 중' : partner.status === 'ACTIVE' ? '완주 혜택' : '시연 혜택'}</em></div>
            <h3>{partner.name}</h3>
            <strong>{partner.offerTitle}</strong>
            {partner.addr && <p>{partner.addr}</p>}
          </div>
        </article>)}
        {partners.length === 0 && <div className="card empty-home">로컬 파트너 혜택을 준비하고 있어요.</div>}
      </div>
      <p className="benefit-note">러너스테이의 할인율은 제휴 확정 후 공개됩니다. 시연 혜택은 실제 사용 전 매장 확인이 필요해요.</p>

      <div className="section-title"><h2>코스</h2><Link href="/courses/new">+ 직접 만들기</Link></div>
      <div className="course-list">
        {courses.map((c, i) => (
          <div className="course" key={c.id}>
            <div className={`thumb ${c.source === 'USER' ? 'user' : `t${i % 4}`}`}>{c.thumbnailUrl && <img src={mediaUrl(c.thumbnailUrl)} alt="" />}</div>
            <div><h4>{c.name}</h4><p>{(c.distanceM / 1000).toFixed(1)}km · {c.difficulty} · {c.themes.join('/')}{best?.course.id === c.id ? ' · ' : ''}{best?.course.id === c.id && <b style={{ color: 'var(--blue)' }}>AI 추천</b>}</p></div>
            <Link className="go" href={`/courses/${c.slug}`}>보기</Link>
          </div>
        ))}
      </div>
      <p className="note">코스·관광지 데이터는 한국관광공사 TourAPI 4.0 형식으로 저장·갱신됩니다. LIVE 배지가 붙은 값은 지금 API에서 받아온 실데이터입니다.</p>
    </main>
  );
}
