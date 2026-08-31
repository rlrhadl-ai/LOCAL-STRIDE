'use client';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Props = { mode: 'login' | 'signup'; nextPath?: string; defaultEmail?: string; adminContext?: boolean };

export default function AccountAuthForm({ mode, nextPath = '/me', defaultEmail = '', adminContext = false }: Props) {
  const router = useRouter();
  const signup = mode === 'signup';
  const [email, setEmail] = useState(defaultEmail);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (signup && password !== confirm) return setError('비밀번호가 서로 일치하지 않습니다');
    if (signup && !accepted) return setError('이용약관과 개인정보·위치정보 안내에 동의해 주세요');
    setLoading(true);
    try {
      await api.post(`/auth/${mode}`, { email, password, ...(signup ? { nickname } : {}) });
      router.replace(nextPath); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : '요청을 처리하지 못했습니다'); }
    finally { setLoading(false); }
  }

  const otherHref = signup ? `/login?next=${encodeURIComponent(nextPath)}` : `/signup?next=${encodeURIComponent(nextPath)}`;
  return <main className="account-auth-page">
    <section className="account-auth-card">
      <Link href="/" className="account-auth-brand"><img src="/logo-blue.png" alt="LOCAL STRIDE" /></Link>
      <div className="account-auth-copy">
        <span>{adminContext ? 'ADMIN ACCESS' : 'RUN YOUR CITY'}</span>
        <h1>{signup ? '러너 계정 만들기' : adminContext ? '관리자 계정으로 로그인' : '다시 달리러 왔군요'}</h1>
        <p>{signup ? '기록과 완주 혜택을 안전하게 보관하고 여러 기기에서 이어가세요.' : adminContext ? '일반 LOCAL STRIDE 계정으로 로그인하면 관리자 권한을 확인합니다.' : '내 기록, 목표와 러닝 프로필을 한곳에서 관리하세요.'}</p>
      </div>
      <form className="account-auth-form" onSubmit={submit}>
        {signup && <label className="field">공개 닉네임<input className="input" value={nickname} onChange={(event) => setNickname(event.target.value)} minLength={2} maxLength={16} placeholder="러너들에게 보일 이름" autoComplete="nickname" required /></label>}
        <label className="field">이메일<input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></label>
        <label className="field">비밀번호<input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={100} placeholder="영문과 숫자를 포함해 8자 이상" autoComplete={signup ? 'new-password' : 'current-password'} required /></label>
        {signup && <label className="field">비밀번호 확인<input className="input" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} maxLength={100} autoComplete="new-password" required /></label>}
        {signup && <label className="account-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required/><span><Link href="/terms" target="_blank">이용약관</Link>과 <Link href="/privacy" target="_blank">개인정보·위치정보 안내</Link>를 확인했으며 이에 동의합니다.</span></label>}
        {error && <p className="account-auth-error" role="alert">{error}</p>}
        <button className="btn account-auth-submit" disabled={loading}>{loading ? '처리 중…' : signup ? '회원가입' : '로그인'}</button>
      </form>
      <p className="account-auth-switch">{signup ? '이미 계정이 있나요?' : '처음 오셨나요?'} <Link href={otherHref}>{signup ? '로그인' : '회원가입'}</Link></p>
      {adminContext && <p className="account-auth-admin-help">최초 관리자 등록이 필요하다면 <Link href="/admin/signup">관리자 계정 설정</Link></p>}
      <Link href="/" className="account-auth-home">← 서비스 홈으로</Link>
    </section>
  </main>;
}
