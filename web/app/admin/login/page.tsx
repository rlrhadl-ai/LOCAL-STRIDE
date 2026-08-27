import AccountAuthForm from '@/components/AccountAuthForm';
export default function AdminLoginPage() { return <AccountAuthForm mode="login" nextPath="/admin" defaultEmail="toy146@naver.com" adminContext />; }
