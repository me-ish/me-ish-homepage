// Disposable CI helper only. Parent kills this exact child after the reported durable boundary.
import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import Stripe from 'stripe';
import {NextRequest} from 'next/server';
async function main(){
 const {origin}=JSON.parse(readFileSync('/runtime/network.json','utf8'));
 if(!/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin))throw new Error('DESTINATION_REJECTED');
 const keys=JSON.parse(readFileSync('/runtime/credentials.json','utf8')),event=JSON.parse(readFileSync(0,'utf8')) as Stripe.Event;
 const direct=globalThis.fetch;globalThis.fetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(u.origin!==origin)return Promise.reject(new Error('DESTINATION_REJECTED'));return direct(input,init);};
 const owner=process.argv[2],mode=process.argv[3];
 if(!/^[0-9a-f-]{36}$/.test(owner??'')||!['claim','commit'].includes(mode??''))throw new Error('HELPER_INPUT');
 if(mode==='claim'){
  const {normalizeNatoriPaymentEvent}=await import('../../src/features/natori/lib/paymentEvent');
  const input=normalizeNatoriPaymentEvent(event),db=createClient(origin,keys.service,{auth:{persistSession:false}});
  const result=await db.rpc('natori_stripe_event_claim_v1',{p_owner_id:owner,p_account:input.account,p_live:false,p_event_id:event.id,p_type:event.type,p_request:input.request,p_claim_token:randomUUID()});
  if(result.error||result.data?.[0]?.result!=='claimed')throw new Error('HELPER_CLAIM');
 }else{
  const secret='whsec_'+randomBytes(32).toString('hex');
  Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:origin,NEXT_PUBLIC_SUPABASE_ANON_KEY:keys.anon,SUPABASE_SERVICE_ROLE_KEY:keys.service,
   STRIPE_SECRET_KEY:'sk_test_'+randomBytes(32).toString('hex'),STRIPE_WEBHOOK_SECRET:secret,NATORI_OWNER_USER_ID:owner,
   NATORI_PAYMENT_INTEGRITY_ENABLED:'1',NATORI_STRIPE_MODE:'test',NATORI_NOTIFICATION_SENDING_ENABLED:'0',RESEND_API_KEY:'',ADMIN_API_TOKEN:''});
  const {POST}=await import('../../src/app/api/webhook/stripe/route');
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!),payload=JSON.stringify(event);
  const response=await POST(new NextRequest('http://localhost/api/webhook/stripe',{method:'POST',body:payload,
   headers:{'stripe-signature':stripe.webhooks.generateTestHeaderString({payload,secret})}}));
  if(response.status!==200)throw new Error('HELPER_COMMIT');
 }
 // No HTTP acknowledgement is sent by this helper. Readiness is non-secret fixture control only.
 process.stdout.write('BOUNDARY_REACHED\n');setInterval(()=>{},1000);
}
main().catch(()=>{process.stdout.write('HELPER_FAILED\n');process.exitCode=1;});
