import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStaging, parseEnv, productionRef } from '../scripts/staging/config.mjs';
const ref='abcdefghijklmnopqrst';
const fixture=()=>({NEXT_PUBLIC_BELA_VIDA_ENVIRONMENT:'staging',NEXT_PUBLIC_BELA_VIDA_STAGING_PROJECT_REF:ref,NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_controlled_test'});
test('staging refuses production even when explicitly labelled as staging',()=>{
 const env=fixture();env.NEXT_PUBLIC_BELA_VIDA_STAGING_PROJECT_REF=productionRef;env.NEXT_PUBLIC_SUPABASE_URL=`https://${productionRef}.supabase.co`;assert.throws(()=>assertStaging(env));
});
test('staging refuses mismatched URLs, secrets, placeholders and missing flags',()=>{
 for(const patch of [{NEXT_PUBLIC_SUPABASE_URL:`https://${productionRef}.supabase.co`},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_no'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_replace_me'},{NEXT_PUBLIC_BELA_VIDA_ENVIRONMENT:'production'},{NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co/?redirect=production`}]) assert.throws(()=>assertStaging({...fixture(),...patch}));
});
test('staging accepts an explicitly isolated project and parses only its config',()=>{
 assert.equal(assertStaging(fixture()).ref,ref);assert.deepEqual(parseEnv('# example\nA="one"\nB=two\n'),{A:'one',B:'two'});assert.throws(()=>parseEnv('invalid config'));
});
