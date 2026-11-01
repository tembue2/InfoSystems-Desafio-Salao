'use client';
import { Entry } from '@/components/management/entry';
export default function ManagementFailure({ reset }: { reset: () => void }) {
  return <Entry><h2>Não foi possível abrir a gestão.</h2><p role="alert">Verifique a ligação e tente novamente.</p><button className="mg-button" onClick={reset}>Tentar novamente</button><a className="mg-back-site" href="/">Voltar ao site do salão</a></Entry>;
}
