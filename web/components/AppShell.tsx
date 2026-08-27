'use client';
import { usePathname } from 'next/navigation';
import TabBar from './TabBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const admin = pathname.startsWith('/admin');
  return <div className={`shell ${admin ? 'admin-shell' : ''}`}>{children}{!admin && <TabBar />}</div>;
}
