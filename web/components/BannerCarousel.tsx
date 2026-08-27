'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { mediaUrl } from '@/lib/api';
import type { HomeBanner } from '@/lib/types';

export default function BannerCarousel({ items }: { items: HomeBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 4500);
    return () => window.clearInterval(timer);
  }, [items.length, paused]);

  useEffect(() => { if (index >= items.length) setIndex(0); }, [index, items.length]);
  if (!items.length) return null;

  const move = (direction: number) => setIndex((current) => (current + direction + items.length) % items.length);
  return <section className="banner-carousel" aria-label="LOCAL STRIDE 소식" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onTouchStart={(event) => { touchX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const end = event.changedTouches[0]?.clientX; if (touchX.current != null && end != null && Math.abs(end - touchX.current) > 42) move(end < touchX.current ? 1 : -1); touchX.current = null; }}>
    <div className="banner-track" style={{ transform: `translateX(-${index * 100}%)` }}>
      {items.map((banner) => {
        const picture = <img src={mediaUrl(banner.imageUrl)} alt={`${banner.title}${banner.subtitle ? ` — ${banner.subtitle}` : ''}`} />;
        return <article className="banner-slide" key={banner.id}>{banner.linkUrl ? <Link href={banner.linkUrl} aria-label={banner.title}>{picture}</Link> : picture}</article>;
      })}
    </div>
    {items.length > 1 && <div className="banner-dots" aria-label="배너 선택">{items.map((banner, itemIndex) => <button type="button" key={banner.id} className={itemIndex === index ? 'on' : ''} aria-label={`${itemIndex + 1}번째 배너`} aria-current={itemIndex === index ? 'true' : undefined} onClick={() => setIndex(itemIndex)} />)}</div>}
  </section>;
}
