export function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('A ligação ao serviço de gestão não está configurada.');
  if (!/^https?:\/\//.test(url) || !key.startsWith('sb_publishable_')) {
    throw new Error('Configure o URL e uma chave pública publishable do Supabase.');
  }
  return { url, key };
}
