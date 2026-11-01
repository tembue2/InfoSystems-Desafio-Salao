import type {Metadata} from 'next';
import Management from '@/components/management/workspace';
import './management.css';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireAccess} from '@/lib/management/access';
import {managementError} from '@/lib/management/errors';
import {loadWorkspace} from '@/lib/management/services/workspace';
export const metadata:Metadata={title:'Gestão — Salão Bela Vida',description:'Gestão do salão: recepção e gerente.',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function ManagementPage(){
 let access;
 try {access=await requireAccess(await createClient());}
 catch(error){const failure=managementError(error);if(['unauthenticated','forbidden'].includes(failure.code))redirect('/gestao/entrar/');throw failure;}
 return <Management access={access} initialData={await loadWorkspace(await createClient())}/>;
}
