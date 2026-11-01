'use client';
import { useActionState } from 'react';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { login } from '@/app/gestao/entrar/actions';
import { Entry } from './entry';

export default function Login({ message = '' }: { message?: string }) {
  const [state, action, pending] = useActionState(login, { error: '' });
  return <Entry>
    <span className="mg-demo-pill">Acesso da equipa</span>
    <h2>Bem-vinda à gestão.</h2><p>Entre com a sua conta de Recepção ou Gerente.</p>
    <form action={action} className="mg-form">
      <label>Email<input name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending}/></label>
      <label>Palavra-passe<input name="password" type="password" autoComplete="current-password" required maxLength={4096} disabled={pending}/></label>
      {(state.error || message) && <p role="alert" className="mg-form-error">{state.error || message}</p>}
      <button className="mg-button" disabled={pending} aria-busy={pending}>{pending ? 'A entrar…' : 'Entrar'}</button>
    </form>
    <div className="mg-entry-notice"><ShieldCheck size={18}/><p>O acesso e as operações disponíveis são definidos pelo perfil da sua conta.</p></div>
    <a className="mg-back-site" href="/">Voltar ao site do salão <ArrowUpRight size={14}/></a>
  </Entry>;
}
