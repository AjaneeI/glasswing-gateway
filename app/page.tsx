import { LoginPage } from '@/components/auth/login-page';
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <LoginPage confirmationError={params.error === 'confirmation'} />;
}
