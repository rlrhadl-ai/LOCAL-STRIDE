import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://localstride.kr'),
  title: 'LOCAL STRIDE · GPS로 발견하는 대구 러닝 관광',
  description: 'GPS 러닝과 한국관광공사 TourAPI로 대구 9개 구·군의 관광지와 로컬 장소를 발견하는 러닝 관광 플랫폼',
  alternates: { canonical: '/' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  manifest: '/manifest.json',
  openGraph: {
    title: 'LOCAL STRIDE · GPS로 발견하는 대구 러닝 관광',
    description: '달리는 동안 한국관광공사 TourAPI 기반 관광지와 로컬 장소를 자동으로 발견하세요.',
    url: 'https://localstride.kr',
    siteName: 'LOCAL STRIDE',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/social/localstride-share.jpg', width: 1200, height: 630, alt: 'LOCAL STRIDE · GPS로 발견하는 대구 러닝 관광' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LOCAL STRIDE · GPS로 발견하는 대구 러닝 관광',
    description: '달리는 동안 한국관광공사 TourAPI 기반 관광지와 로컬 장소를 자동으로 발견하세요.',
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
