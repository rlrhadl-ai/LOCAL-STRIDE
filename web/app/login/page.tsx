import AccountAuthForm from '@/components/AccountAuthForm';

const safeNext = (value?: string) => value?.startsWith('/') && !value.startsWith('//') ? value : '/me';
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return <AccountAuthForm mode="login" nextPath={safeNext(params.next)} />;
}
