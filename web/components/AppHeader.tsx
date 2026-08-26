'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function AppHeader({ title, back, right }: { title?: string; back?: boolean; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="app-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {back && <button className="icon-btn" type="button" aria-label="뒤로" onClick={() => router.back()}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></button>}
        {title ? <h1>{title}</h1> : <Link href="/" aria-label="홈"><img src="/logo-blue.png" alt="local Stride" /></Link>}
      </div>
      <div>{right}</div>
    </div>
  );
}
