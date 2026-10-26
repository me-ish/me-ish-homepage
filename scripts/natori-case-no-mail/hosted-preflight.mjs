// Future approved build only. Exact read-only calls; never seed or repair data.
import {pathToFileURL} from 'node:url';
import {assertOperationPlatform} from './hosted-gate.mjs';
import {readControl} from '../natori-case-hosted/runner.mjs';
export async function operationPreflight(env,plan,transport=fetch,now=()=>Date.now()) {
 assertOperationPlatform(env,plan,now());
 if(!/^rk_test_[A-Za-z0-9_]+$/.test(env.STRIPE_SECRET_KEY??'')
  ||!(env.STRIPE_WEBHOOK_SECRET??'').startsWith('whsec_')
  ||!/^[a-f0-9]{64}$/i.test(env.NATORI_DELIVERY_NOTIFICATION_KEY??'')
  ||!(env.SUPABASE_SERVICE_ROLE_KEY?.length>20))throw Error('operation_secrets_missing');
 await readControl(plan,env.SUPABASE_SERVICE_ROLE_KEY,transport,now);
 // This is the first Stripe request; never replace the key or widen its scope
 // after a 403. A failed account proof aborts the build before any object write.
 let response;
 try {response=await transport('https://api.stripe.com/v1/account',{method:'GET',headers:{Authorization:'Bearer '+env.STRIPE_SECRET_KEY},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});}
 catch {throw Error('operation_stripe_account_unreachable');}
 if(response.status===403)throw Error('operation_stripe_account_permission');
 if(response.status!==200||response.redirected)throw Error('operation_stripe_account_unconfirmed');
 let account;try {account=await response.json();}catch {throw Error('operation_stripe_account_unconfirmed');}
 if(account?.id!==plan.stripe.account)throw Error('operation_stripe_account_mismatch');
 return {confirmed:true,mailAttempts:0,mutations:0,providerReads:1};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {const {plan}=await import('./operation-plan.mjs');console.log(JSON.stringify(await operationPreflight(process.env,plan)));}
 catch(error) {const safe=['operation_stripe_account_permission','operation_stripe_account_unreachable','operation_stripe_account_unconfirmed','operation_stripe_account_mismatch'];console.error('[no-mail-operation]',safe.includes(error?.message)?error.message:'preflight_unconfirmed');process.exitCode=1;}
}
