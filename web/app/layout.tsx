import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://localstride.kr'),
  title: 'LOCAL STRIDE · 대구 토박이가 만든 대구 러닝 앱',
  description: '대구 러너가 고른 코스, 로컬 러닝 메이트, 아침런과 퇴근런을 한곳에서 만나는 대구 러닝 커뮤니티',
  manifest: '/manifest.json',
  openGraph: {
    title: 'LOCAL STRIDE · 대구 토박이가 만든 대구 러닝 앱',
    description: '대구의 길과 사람을 연결하는 아침런·퇴근런·주제형 로컬 러닝 커뮤니티',
    url: 'https://localstride.kr',
    siteName: 'LOCAL STRIDE',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/social/localstride-share.jpg', width: 1200, height: 630, alt: 'LOCAL STRIDE · 대구 토박이가 만든 대구 러닝 앱' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LOCAL STRIDE · 대구 토박이가 만든 대구 러닝 앱',
    description: '대구의 길과 사람을 연결하는 아침런·퇴근런·주제형 로컬 러닝 커뮤니티',
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
