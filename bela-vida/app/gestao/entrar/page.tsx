import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAccess } from '@/lib/management/access';
import { managementError } from '@/lib/management/errors';
import Login from '@/components/management/login';
import '../management.css';

export const metadata = { title: 'Entrar — Gestão Bela Vida', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  let message = '';
  let allowed = false;
  try {
    await requireAccess(await createClient());
    allowed = true;
  } catch (error) {
    const failure = managementError(error);
    if (failure.code !== 'unauthenticated') message = failure.message;
  }
  if (allowed) redirect('/gestao/');
  return <Login message={message}/>;
}
