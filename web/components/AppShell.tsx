'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import TabBar from './TabBar';
import { DaeguAreaProvider } from './DaeguAreaProvider';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const admin = pathname.startsWith('/admin');
  return <DaeguAreaProvider>
    <div className={`app-stage ${admin ? 'admin-stage' : ''}`}>
      {!admin && <aside className="desktop-showcase" aria-label="LOCAL STRIDE 서비스 소개">
        <Link href="/" className="desktop-brand" aria-label="LOCAL STRIDE 홈"><Image src="/logo-white.png" alt="LOCAL STRIDE" width={154} height={43} priority /></Link>
        <p className="desktop-kicker">DAEGU RUNNING TOURISM</p>
        <h1>달리는 순간,<br/><em>대구가 여행이 됩니다.</em></h1>
        <p className="desktop-summary">위치 기반 코스와 공공 관광데이터를 연결해 러너가 대구의 길·사람·장소를 자연스럽게 발견하도록 돕습니다.</p>
        <ol className="desktop-flow">
          <li><b>01</b><span><strong>내 지역을 선택하고</strong><small>대구 9개 구·군의 러닝 거점을 확인해요.</small></span></li>
          <li><b>02</b><span><strong>검증된 코스를 찾아</strong><small>거리·분위기·날씨에 맞는 길을 골라요.</small></span></li>
          <li><b>03</b><span><strong>달리며 로컬을 발견해요</strong><small>관광지와 동네 장소를 위치 기반으로 만나요.</small></span></li>
        </ol>
        <div className="desktop-data"><span>LIVE DATA</span><p>한국관광공사 TourAPI · 기상청 · 에어코리아</p></div>
      </aside>}
      <div className={`shell ${admin ? 'admin-shell' : ''}`}>{children}{!admin && <TabBar />}</div>
    </div>
  </DaeguAreaProvider>;
}
