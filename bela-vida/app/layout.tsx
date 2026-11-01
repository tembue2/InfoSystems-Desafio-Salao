import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title:'Salão Bela Vida — O seu momento de cuidado',description:'Cabelo, tranças, unhas e maquilhagem. Consulte os preços e peça a sua marcação pelo WhatsApp.' };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="pt-MZ"><body>{children}</body></html>;}
