import Link from 'next/link';
import { MATES } from '@/lib/ai-mate';
import MateAvatar from './MateAvatar';

export default function MateBanner({ finished = false }: { finished?: boolean }) {
  return <Link className="mate-entry" href={finished ? '/ai-mate#feedback' : '/ai-mate'}>
    <div><span>AI MATE · 나의 러닝 친구</span><strong>{finished ? '오늘의 러닝, 어땠나요?' : '나랑 같이 달릴래요?'}</strong><p>{finished ? '메이트에게 알려주고 다음 코스를 골라요.' : '페이스부터 다음 코스까지, 메이트와 함께.'}</p><b>{finished ? '러닝 돌아보기' : '내 메이트 만나기'} <span aria-hidden>↗</span></b></div>
    <div className="mate-entry-art" aria-hidden>{MATES.map((mate) => <MateAvatar key={mate.id} mateId={mate.id} mood={finished ? 'cheering' : 'idle'} decorative/>)}</div>
  </Link>;
}
