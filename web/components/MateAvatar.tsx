import Image from 'next/image';
import { mateById, type MateId } from '@/lib/ai-mate';

export type MateMood = 'idle' | 'thinking' | 'talking' | 'cheering' | 'resting';
const FRAMES: Record<MateMood, [number, number]> = { idle: [0, 0], thinking: [1, 0], talking: [2, 0], cheering: [1, 1], resting: [2, 1] };
const LABELS: Record<MateMood, string> = { idle: '반갑게 웃는', thinking: '생각하는', talking: '이야기하는', cheering: '환호하는', resting: '편안하게 쉬는' };

export default function MateAvatar({ mateId, mood = 'idle', decorative = false, className = '', priority = false }: { mateId: MateId; mood?: MateMood; decorative?: boolean; className?: string; priority?: boolean }) {
  const mate = mateById(mateId), [column, row] = FRAMES[mood];
  return <span className={`running-mate-avatar mood-${mood} ${className}`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : `${LABELS[mood]} ${mate.animal} ${mate.name}`} aria-hidden={decorative || undefined} data-mood={mood}>
    <Image src={`/images/mates/${mate.id}-states.png`} alt="" width={1536} height={1024} sizes="(max-width: 480px) 600px, 720px" priority={priority} draggable={false} style={{ left: `${-column * 100}%`, top: `${-row * 100}%` }}/>
  </span>;
}
