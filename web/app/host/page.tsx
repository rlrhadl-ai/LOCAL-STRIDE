import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

const choices = [
  { code: '01', tone: 'quick', title: '번개런 모집', copy: '한 번 함께 달릴 러너를 빠르게 모집해요.', meta: '1분 · 바로 공개', href: '/mates?create=1', action: '번개런 만들기' },
  { code: '02', tone: 'crew', title: '정기 크루 개설', copy: '라이프스타일과 페이스가 맞는 지속적인 모임을 만들어요.', meta: '3분 · 크루 프로필 공개', href: '/crews/new', action: '크루 만들기' },
  { code: '03', tone: 'event', title: '공식 행사 제안', copy: '로컬 상권·관광지와 연계한 러닝 프로그램을 제안해요.', meta: '5분 · 운영자 검토 후 공개', href: '/host/proposal', action: '행사 제안하기' },
];

export default function HostPage() {
  return <main className="page host-page">
    <AppHeader back title="러닝 개최하기" />
    <section className="host-hero"><span>CREATE A LOCAL RUN</span><h1>어떤 러닝을<br />만들고 싶으세요?</h1><p>목적에 따라 필요한 정보와 공개 절차를 다르게 준비했어요.</p></section>
    <section className="host-choice-list">{choices.map((choice) => <Link href={choice.href} className={`host-choice ${choice.tone}`} key={choice.code}><span className="host-choice-code">{choice.code}</span><div><small>{choice.meta}</small><h2>{choice.title}</h2><p>{choice.copy}</p><strong>{choice.action} →</strong></div></Link>)}</section>
    <section className="host-principles"><h2>모두가 안전하게 달리기 위해</h2><div><span><b>공개 집결지</b>자택 주소는 입력하지 않아요.</span><span><b>적정 페이스</b>거리와 속도를 미리 공개해요.</span><span><b>행사 검토</b>대규모 행사는 운영자 확인 후 열어요.</span></div></section>
  </main>;
}
