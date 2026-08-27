import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://localstride.kr'),
  title: 'LOCAL STRIDE · 달리면서 여행하는 도시, 대구',
  description: '러닝 코스를 따라 관광·소비·경험이 연결되는 대구 특화 러닝 관광 플랫폼',
  manifest: '/manifest.json',
  openGraph: {
    title: 'LOCAL STRIDE · 달리면서 여행하는 도시, 대구',
    description: 'GPS 러닝으로 대구의 관광·로컬 혜택을 만나는 러닝 관광 플랫폼',
    url: 'https://localstride.kr',
    siteName: 'LOCAL STRIDE',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/social/localstride-share.jpg', width: 1200, height: 630, alt: 'LOCAL STRIDE · 달리면서 여행하는 도시, 대구' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LOCAL STRIDE · 달리면서 여행하는 도시, 대구',
    description: 'GPS 러닝으로 대구의 관광·로컬 혜택을 만나는 러닝 관광 플랫폼',
    images: ['/social/localstride-share.jpg'],
  },
};
export const viewport: Viewport = { themeColor: '#0B1F55', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
