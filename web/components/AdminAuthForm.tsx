'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminJson } from '@/lib/admin-api';

export default function AdminAuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('LOCAL STRIDE 관리자');
  const [setupCode, setSetupCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const signup = mode === 'signup';

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try {
      await adminJson(`/auth/${mode}`, 'POST', { email: 'toy146@naver.com', password, ...(signup ? { nickname, setupCode } : {}) });
      router.replace('/admin'); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다'); }
    finally { setLoading(false); }
  }

  return <main className="admin-auth-page">
    <section className="admin-auth-card">
      <Link href="/" className="admin-brand"><img src="/logo-blue.png" alt="LOCAL STRIDE" /></Link>
      <div className="admin-auth-copy"><span>ADMIN CONSOLE</span><h1>{signup ? '관리자 계정 만들기' : '관리자 로그인'}</h1><p>{signup ? '최초 1회 비밀번호를 설정하면 바로 관리 화면으로 이동합니다.' : '콘텐츠와 서비스 운영 데이터를 안전하게 관리하세요.'}</p></div>
      <form onSubmit={submit} className="admin-auth-form">
        <label className="field">관리자 이메일<input className="input" type="email" value="toy146@naver.com" readOnly /></label>
        {signup && <label className="field">표시 이름<input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={20} required /></label>}
        {signup && <label className="field">최초 가입 코드<input className="input" type="password" value={setupCode} onChange={(event) => setSetupCode(event.target.value)} minLength={8} autoComplete="one-time-code" placeholder="배포 시 발급된 1회용 코드" required /></label>}
        <label className="field">비밀번호<input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={100} autoComplete={signup ? 'new-password' : 'current-password'} placeholder="10자 이상 입력" required /></label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? '처리 중…' : signup ? '관리자 회원가입' : '로그인'}</button>
      </form>
      <p className="admin-auth-switch">{signup ? '이미 계정이 있나요?' : '최초 접속인가요?'} <Link href={signup ? '/admin/login' : '/admin/signup'}>{signup ? '로그인' : '관리자 회원가입'}</Link></p>
    </section>
  </main>;
}
