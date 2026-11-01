import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export const productionRef = 'rslyimjlwvvgnwfohzmr';

export function parseEnv(source) {
  const result = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) throw new Error('Linha inválida na configuração de testes.');
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
    result[match[1]] = value;
  }
  return result;
}
export function assertStaging(env) {
  const ref = env.NEXT_PUBLIC_BELA_VIDA_STAGING_PROJECT_REF;
  if (env.NEXT_PUBLIC_BELA_VIDA_ENVIRONMENT !== 'staging' || !/^[a-z]{20}$/.test(ref ?? '') || ref === productionRef) throw new Error('Recusado: indique um projecto de testes isolado.');
  let url;
  try { url = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { throw new Error('URL de testes inválido.'); }
  if (url.origin !== `https://${ref}.supabase.co` || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('O URL não corresponde ao projecto de testes autorizado.');
  if (!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.includes('replace')) throw new Error('Configure a chave publishable do ramo de testes.');
  return { ref, url: url.origin, key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}
export function stagingEnvironment() {
  let values;
  try { values = parseEnv(readFileSync(new URL('../../.env.staging.local', import.meta.url), 'utf8')); }
  catch { throw new Error('O ramo de testes ainda não está configurado. Preencha .env.staging.local a partir de .env.staging.example.'); }
  assertStaging(values);
  return values;
}
export function stagingAccounts() {
  const values = parseEnv(readFileSync(new URL('../../.env.staging.accounts.local', import.meta.url),'utf8'));
  for (const role of ['MANAGER','RECEPTION','CUSTOMER']) {
    if (!values[`STAGING_${role}_EMAIL`]?.endsWith('@bela-vida.invalid') || !values[`STAGING_${role}_PASSWORD`] || values[`STAGING_${role}_PASSWORD`].includes('replace')) throw new Error('Configure apenas as contas fictícias de testes.');
  }
  return values;
}
