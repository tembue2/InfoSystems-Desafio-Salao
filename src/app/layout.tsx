import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = {title:'Salão de Beleza | InfoSystems MVP',description:'Demonstração de gestão e marcações para desafio InfoSystems'};
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="pt"><body><header className="header"><div className="shell nav"><Link className="brand" href="/">✦ Salão Gestão</Link><nav><Link href="/reservar">Reservar</Link><Link href="/minhas-marcacoes">Minhas marcações</Link><Link href="/admin">Gestão</Link><Link href="/entrar">Conta</Link></nav></div></header><main className="shell">{children}</main><footer className="shell footer">Protótipo de avaliação técnica · dados demonstrativos · moeda MZN</footer></body></html>;
}
