import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

export default function TermsPage() {
  return <main className="page legal-page">
    <AppHeader back title="이용약관" />
    <section className="legal-hero"><span>TERMS OF SERVICE</span><h1>안전하고 정직한 러닝 기록을 위한 약속입니다.</h1><p>LOCAL STRIDE MVP 이용 시 지켜야 할 기본 기준입니다.</p></section>
    <section className="legal-card"><h2>서비스 범위</h2><p>대구 러닝 코스, 위치 기반 관광정보, GPS 러닝 기록, 커뮤니티와 보상 시나리오를 제공합니다. 시범으로 표시된 일정·모집·대회·혜택은 실제 계약이나 결제 대상이 아닙니다.</p></section>
    <section className="legal-card"><h2>안전 책임</h2><p>이용자는 현장 통제, 교통법규, 날씨와 건강 상태를 우선 확인해야 합니다. 화면을 보며 달리지 말고 위험 구간에서는 속도를 줄이거나 러닝을 중단해 주세요.</p></section>
    <section className="legal-card"><h2>기록의 공정성</h2><p>GPS 조작, 타인의 계정 사용, 비정상적인 위치·속도 기록은 완주·랭킹·보상에서 제외될 수 있습니다. 자동 검증 결과에 오류가 있다면 운영자 검토를 요청할 수 있습니다.</p></section>
    <section className="legal-card"><h2>콘텐츠와 변경</h2><p>코스, 관광지, 일정과 혜택은 공공데이터 갱신 및 현장 상황에 따라 달라질 수 있습니다. 정식 운영 전에는 기능과 정책을 변경할 수 있으며 중요한 변경은 서비스에서 안내합니다.</p></section>
    <p className="legal-date">시행일: 2026년 8월 31일 · <Link href="/privacy">개인정보·위치정보 안내 보기</Link></p>
  </main>;
}
