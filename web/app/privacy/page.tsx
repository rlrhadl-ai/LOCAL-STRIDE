import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

export default function PrivacyPage() {
  return <main className="page legal-page">
    <AppHeader back title="개인정보·위치정보 안내" />
    <section className="legal-hero"><span>PRIVACY & LOCATION</span><h1>달리는 기록을 필요한 만큼만 사용합니다.</h1><p>LOCAL STRIDE MVP의 개인정보와 위치정보 처리 기준입니다.</p></section>
    <section className="legal-card"><h2>수집하는 정보</h2><p>회원가입 시 이메일·공개 닉네임·암호화된 비밀번호를, 비회원 이용 시 익명 기기 식별자를 사용합니다. 실제 러닝을 시작한 동안에만 GPS 좌표·시간·정확도·체크포인트 통과 기록을 수집합니다.</p></section>
    <section className="legal-card"><h2>이용 목적</h2><p>코스 출발 확인, 이동 거리 계산, 자동 체크인, 완주 검증, 관광지 안내, 부정 기록 방지와 서비스 장애 복구에 사용합니다. 공개 화면에는 닉네임과 사용자가 선택한 프로필 정보만 표시합니다.</p></section>
    <section className="legal-card"><h2>위치 권한과 외부 데이터</h2><p>GPS 권한을 거부하면 실제 러닝 기록 기능은 사용할 수 없지만 코스·관광지·프로그램은 계속 둘러볼 수 있습니다. 주변 관광지 검색 시 서버가 현재 좌표를 한국관광공사 TourAPI 요청에 사용하며, 관광정보 결과는 장애 대응과 호출량 절감을 위해 캐시할 수 있습니다.</p></section>
    <section className="legal-card"><h2>보관과 삭제</h2><p>계정 정보와 완주 기록은 계정 유지 기간 동안 보관합니다. 진행 중인 오프라인 GPS 기록은 전송 완료 후 기기에서 정리합니다. 삭제가 필요한 경우 운영자에게 요청할 수 있으며 확인 후 관련 기록을 처리합니다.</p></section>
    <section className="legal-card"><h2>MVP 시범 콘텐츠</h2><p>시범 일정·크루·대회·쿠폰은 기능 검증용이며 실제 신청, 결제 또는 혜택으로 사용되지 않습니다. 정식 운영 시 변경된 처리방침과 운영 정보를 다시 안내합니다.</p></section>
    <p className="legal-date">시행일: 2026년 8월 31일 · <Link href="/terms">이용약관 보기</Link></p>
  </main>;
}
