'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
export default function Entrar(){
 const [register,setRegister]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[name,setName]=useState(''),[phone,setPhone]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setMessage('');try{
  if(register){const {error}=await supabase().auth.signUp({email,password,options:{data:{full_name:name,phone}}});if(error)throw error;setMessage('Registo recebido. Confirme o e-mail se a validação de e-mail estiver activa.');}
  else{const {error}=await supabase().auth.signInWithPassword({email,password});if(error)throw error;window.location.href='/reservar';}
 }catch(e){setMessage((e as Error).message)}finally{setLoading(false)}}
 async function logout(){await supabase().auth.signOut();setMessage('Sessão terminada.');}
 return <><div className="pagehead"><div className="eyebrow">Conta</div><h1>{register?'Criar conta':'Entrar'}</h1><p>Para reservar é necessário iniciar sessão. A palavra-passe nunca é guardada nesta aplicação.</p></div><div className="card" style={{maxWidth:480}}><form onSubmit={submit}>{register&&<><label>Nome completo<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Telemóvel / WhatsApp<input value={phone} onChange={e=>setPhone(e.target.value)}/></label></>}<label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Palavra-passe<input type="password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button disabled={loading}>{loading?'Aguarde…':register?'Criar conta':'Entrar'}</button></form><p><button className="button ghost" onClick={()=>{setRegister(!register);setMessage('')}}>{register?'Já tenho conta':'Criar nova conta'}</button> <button className="button ghost" onClick={logout}>Sair</button></p>{message&&<div className="notice">{message}</div>}</div></>;
}
