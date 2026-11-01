import { Flower2, CalendarDays, Users, Wallet } from 'lucide-react';

export function Entry({ children }: { children: React.ReactNode }) {
  return <div className="management mg-entry">
    <div className="mg-entry-story">
      <a className="mg-logo" href="/"><Flower2 size={34} strokeWidth={1.2}/><span>bela vida<small>Gestão do salão</small></span></a>
      <div><span className="mg-eyebrow">Mais cuidado. Mais organização.</span><h1>Um salão em<br/> boas mãos.</h1><p>Da primeira marcação ao fecho do dia. Um espaço pensado para a sua equipa trabalhar melhor.</p><div className="mg-entry-pills"><span><CalendarDays size={15}/>Agenda</span><span><Users size={15}/>Clientes</span><span><Wallet size={15}/>Pagamentos</span></div></div>
      <p className="mg-entry-bottom">Bela Vida · O cuidado também começa por dentro.</p><Flower2 className="mg-entry-flower" size={330} strokeWidth={.3} aria-hidden="true"/>
    </div>
    <main className="mg-entry-main"><div className="mg-entry-box">{children}</div></main>
  </div>;
}
