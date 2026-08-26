import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import TabBar from '@/components/TabBar';

export const metadata: Metadata = {
  title: 'LOCAL STRIDE · 달리면서 여행하는 도시, 대구',
  description: '러닝 코스를 따라 관광·소비·경험이 연결되는 대구 특화 러닝 관광 플랫폼',
  manifest: '/manifest.json',
};
export const viewport: Viewport = { themeColor: '#0B1F55', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body>
        <div className="shell">
          {children}
          <TabBar />
        </div>
      </body>
    </html>
  );
}
