'use server';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createClient} from '@/lib/supabase/server';
import {requireAccess} from '@/lib/management/access';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
export async function reviewRequest(form:FormData){
 const client=await createClient();await requireAccess(client);
 const decision=form.get('decision');if(!['approve','reject'].includes(String(decision)))throw new Error('Decisão inválida.');
 const {error}=await (client as unknown as SupabaseClient).rpc('review_booking_request',{p_request:form.get('id'),p_approve:decision==='approve'});
 if(error)redirect('/gestao/pedidos/?error='+encodeURIComponent(error.message));
 revalidatePath('/gestao');revalidatePath('/gestao/pedidos');redirect('/gestao/pedidos/?done=1');
}

