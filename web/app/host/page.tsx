import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

const choices = [
  { code: '01', tone: 'quick', title: '번개런 모집', copy: '날짜·장소·페이스만 정하고 한 번 함께 달릴 러너를 모집해요.', meta: '필수 3개 · 바로 공개', href: '/mates?create=1', action: '번개런 만들기' },
  { code: '02', tone: 'crew', title: '정기 크루 개설', copy: '정기 일정과 모집 조건을 정해 지속적인 모임을 만들어요.', meta: '3단계 · 크루 프로필 공개', href: '/crews/new', action: '크루 만들기' },
  { code: '03', tone: 'event', title: '공식 행사 제안', copy: '로컬 상권·관광지와 연결된 프로그램을 안전 정보와 함께 제안해요.', meta: '3단계 · 운영자 확인', href: '/host/proposal', action: '행사 제안하기' },
];

export default function HostPage() {
  return <main className="page host-page">
    <AppHeader back title="러닝 열기" />
    <section className="host-hero"><span>CREATE A LOCAL RUN</span><h1>유형만 먼저<br />골라보세요.</h1><p>선택한 러닝에 꼭 필요한 항목만 보여드려요. 모든 흐름은 최대 3단계예요.</p></section>
    <section className="host-choice-list">{choices.map((choice) => <Link href={choice.href} className={`host-choice ${choice.tone}`} key={choice.code}><span className="host-choice-code">{choice.code}</span><div><small>{choice.meta}</small><h2>{choice.title}</h2><p>{choice.copy}</p><strong>{choice.action} →</strong></div></Link>)}</section>
    <section className="host-principles"><h2>모두가 안전하게 달리기 위해</h2><div><span><b>공개 집결지</b>자택 주소는 입력하지 않아요.</span><span><b>적정 페이스</b>거리와 속도를 미리 공개해요.</span><span><b>행사 검토</b>대규모 행사는 운영자 확인 후 열어요.</span></div></section>
  </main>;
}
