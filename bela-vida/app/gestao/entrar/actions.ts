'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAccess } from '@/lib/management/access';
import { managementError } from '@/lib/management/errors';

export type LoginState = { error: string };
export async function login(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length > 4096) return { error: 'Indique o email e a palavra-passe da sua conta.' };
  try {
    const client = await createClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return { error: error.status === 429 ? 'Demasiadas tentativas. Aguarde antes de tentar novamente.' : 'Não foi possível iniciar sessão. Verifique as credenciais e a ligação.' };
    try {
      await requireAccess(client);
    } catch (error) {
      await client.auth.signOut({ scope: 'local' });
      return { error: managementError(error).message };
    }
  } catch (error) { return { error: managementError(error).message }; }
  redirect('/gestao/');
}

export async function logout(): Promise<{ error: string } | never> {
  try {
    const client = await createClient();
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) return { error: 'Não foi possível terminar a sessão. Tente novamente.' };
  } catch (error) { return { error: managementError(error).message }; }
  redirect('/gestao/entrar/');
}
