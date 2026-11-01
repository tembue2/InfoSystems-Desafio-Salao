'use client';
import {useEffect,useRef,useContext} from 'react';
import {OperationContext} from './operation-context';
import {X,Inbox,ArrowUpRight} from 'lucide-react';
import {labels,type Status} from '@/lib/management/model';
export function Badge({status}:{status:Status}){return <span className={`mg-badge mg-${status}`}><i/>{labels[status]}</span>}
export function Empty({title='Nada por aqui',text='Experimente ajustar os filtros.'}:{title?:string;text?:string}){return <div className="mg-empty"><Inbox size={30} strokeWidth={1}/><h3>{title}</h3><p>{text}</p></div>}
export function Avatar({name,tone=0}:{name:string;tone?:number}){return <span className={`mg-avatar tone-${tone%3}`}>{name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span>}
export function Panel({title,description,action,children}:{title:string;description?:string;action?:React.ReactNode;children:React.ReactNode}){return <section className="mg-panel"><div className="mg-panel-head"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>{children}</section>}
export function Metric({label,value,foot,icon}:{label:string;value:string|number;foot:string;icon:React.ReactNode}){return <article className="mg-metric"><div><span>{label}</span>{icon}</div><strong>{value}</strong><p>{foot}</p></article>}
export function Modal({title,subtitle,children,onClose,wide=false}:{title:string;subtitle?:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}){
 const busy=useContext(OperationContext);
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();const old=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{dialog?.close();document.body.style.overflow=old}},[]);
 return <dialog ref={ref} className={'mg-dialog'+(wide?' mg-dialog-wide':'')} onCancel={e=>{e.preventDefault();if(!busy)onClose()}} onClick={e=>{if(!busy&&e.target===e.currentTarget)onClose()}} aria-labelledby="mg-modal-title"><header><div><h2 id="mg-modal-title">{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="mg-icon-button" disabled={busy} onClick={onClose} aria-label="Fechar janela"><X size={19}/></button></header><fieldset className="mg-operation-fields" disabled={busy} aria-busy={busy}>{children}</fieldset></dialog>
}
export function LinkButton({children,onClick}:{children:React.ReactNode;onClick:()=>void}){return <button className="mg-link" onClick={onClick}>{children}<ArrowUpRight size={14}/></button>}
