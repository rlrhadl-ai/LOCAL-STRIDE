'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import { api, mediaUrl } from '@/lib/api';
import type { PartnerOffer } from '@/lib/types';

function BenefitIcon({ category }: { category: string }) {
  if (category.includes('카페')) return <svg viewBox="0 0 48 48" fill="none" aria-hidden><path d="M12 17h22v10a10 10 0 0 1-10 10h-2a10 10 0 0 1-10-10V17Z" stroke="currentColor" strokeWidth="3"/><path d="M34 21h3a5 5 0 0 1 0 10h-4M17 11c0 2 2 2 2 4M24 11c0 2 2 2 2 4" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden><path d="M11 32c5-2 7-6 8-13 4 6 8 9 18 10" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><path d="M12 35h25" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"/><circle cx="31" cy="16" r="4" fill="currentColor"/></svg>;
}

export default function BenefitsPage() {
  const [items, setItems] = useState<PartnerOffer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get<{ items: PartnerOffer[] }>('/partners').then((result) => setItems(result.items)).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
  return <main className="page local-content-page">
    <AppHeader back title="러너 혜택"/>
    <section className="local-content-intro benefit"><span>RUN · RECOVER · LOCAL</span><h1>잘 달린 하루의 끝을<br/>대구에서 누려보세요.</h1><p>LOCAL STRIDE 러너를 반기는 웰니스 공간과 로컬 매장을 소개합니다.</p></section>
    <div className="local-content-head"><h2>완주 후 쉬어가기</h2><span>{items.length}개의 로컬 파트너</span></div>
    <div className="benefit-page-list">{items.map((partner) => {
      const runnerDay = partner.name === '러너스데이';
      return <article className={`benefit-page-card ${partner.status === 'COMING_SOON' ? 'featured' : ''} ${runnerDay ? 'coupon-card' : ''}`} key={partner.id}>
        <div className="benefit-page-icon">{partner.imageUrl ? <img src={mediaUrl(partner.imageUrl)} alt=""/> : <BenefitIcon category={partner.category}/>}</div>
        <div><div className="benefit-page-meta"><span>{partner.category}</span><em>{runnerDay ? '데모 쿠폰' : partner.status === 'ACTIVE' ? '완주 혜택' : partner.status === 'COMING_SOON' ? '제휴 준비 중' : '시연 혜택'}</em></div><h2>{partner.name}</h2><strong>{partner.offerTitle}</strong>{partner.addr && <address>{partner.addr}</address>}<p>{runnerDay ? '발표와 서비스 시연을 위한 가상 쿠폰입니다. 실제 매장에서는 사용할 수 없어요.' : partner.status === 'COMING_SOON' ? '제휴 내용이 확정되면 LOCAL STRIDE에서 가장 먼저 알려드릴게요.' : '실제 이용 전 매장에 혜택 적용 여부를 확인해 주세요.'}</p></div>
        {runnerDay && <div className="benefit-coupon-strip"><span><small>RUNNER&apos;S DAY · DEMO</small><b>5,000원 할인</b></span><Link href="/me">내 지갑에서 보기 →</Link></div>}
      </article>;
    })}</div>
    {!loading && items.length === 0 && <div className="empty">새로운 러너 혜택을 준비하고 있어요.</div>}
  </main>;
}
