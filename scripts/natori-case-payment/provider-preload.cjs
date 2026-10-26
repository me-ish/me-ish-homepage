// Disposable Next child only. Exact SDK/fetch boundaries are synthetic, never proxied.
if(process.env.CASE_PAYMENT_LOCAL!=='ephemeral'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://localhost:4193')throw Error('isolated test child required');
const fs=require('node:fs'),Module=require('node:module'),crypto=require('node:crypto');
const log=data=>fs.appendFileSync(process.env.CASE_PAYMENT_EVIDENCE,JSON.stringify(data)+'\n');
let claimLossId;const direct=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(u.href==='https://api.resend.com/emails'){
  const p=JSON.parse(init.body),key=init.headers['Idempotency-Key'];log({boundary:'mail',key,to:p.to,subject:p.subject,tags:p.tags});
  // Synthetic scenario is selected by reserved .invalid recipient, not product configuration.
  if(p.to[0]==='client3@example.invalid')return new Response('{}',{status:503});
  if(p.to[0]==='client8@example.invalid'&&!global.__case8Failure){global.__case8Failure=true;return new Response('{}',{status:422});}
  if(p.to[0]==='client4@example.invalid'&&!global.__caseFailedOnce){global.__caseFailedOnce=true;return new Response('{}',{status:422});}
  return new Response(JSON.stringify({id:'local_'+crypto.createHash('sha256').update(key).digest('hex').slice(0,20)}),{status:200});
 }
 if(u.origin==='https://api.stripe.com'){
  log({boundary:'stripe-http',method:init?.method??'GET',path:u.pathname});
  const reply=v=>Response.json(v),p=u.pathname;
  if(p==='/v1/account')return reply({id:'acct_casefixture'});
  if(p==='/v1/prices')return reply({has_more:false,data:[...prices.values()]});
  if(p.startsWith('/v1/prices/'))return prices.has(p.split('/').at(-1))?reply(prices.get(p.split('/').at(-1))):new Response('{}',{status:404});
  if(p==='/v1/payment_links')return reply({has_more:false,data:[...links.values()]});
  if(p==='/v1/checkout/sessions')return reply({has_more:false,data:[]});
  const m=p.match(/^\/v1\/payment_links\/([^/]+)(\/line_items)?$/);
  if(m&&links.has(m[1])){const l=links.get(m[1]);if(m[2])return reply({has_more:false,data:[{quantity:1,price:prices.get(l.price)}]});if(init?.method==='POST')l.active=false;return reply(l);}
  return new Response('{}',{status:404});
 }
 if(!['http://localhost:4193' ,'http://127.0.0.1:4195','http://localhost:4195'].includes(u.origin))throw Error('non-local fetch denied');
 const r=await direct(input,init);
 if(u.pathname==='/rest/v1/rpc/natori_case_payment_command_v1'&&init?.body){const b=JSON.parse(init.body);
  if(b.p_command==='finish'&&b.p_project_id==='a0000000-0000-4000-8000-000000000009'&&!global.__outboxLoss){global.__outboxLoss=true;throw Error('synthetic response loss after outbox commit');}
  if(b.p_command==='stage'&&b.p_input?.stage==='price'&&['a0000000-0000-4000-8000-000000000014','a0000000-0000-4000-8000-000000000015'].includes(b.p_project_id)){
   global.__receiptPriceLoss??=new Set();if(!global.__receiptPriceLoss.has(b.p_project_id)){global.__receiptPriceLoss.add(b.p_project_id);throw Error('synthetic response loss after saved price');}
  }
  if(b.p_command==='finish'&&b.p_project_id==='a0000000-0000-4000-8000-000000000012')claimLossId=(await r.clone().json()).notificationId;
 }
 if(u.pathname==='/rest/v1/rpc/natori_notification_claim_v1'&&init?.body&&JSON.parse(init.body).p_id===claimLossId&&!global.__claimLoss){global.__claimLoss=true;throw Error('synthetic response loss after notification claim');}
 return r;
};
const prices=new Map(),links=new Map(),keys=new Map(),load=Module._load,id=p=>p+crypto.randomUUID().replaceAll('-','');
Module._load=function(request,parent,isMain){
 const Actual=load.apply(this,arguments);if(request!=='stripe')return Actual;
 class FixtureStripe extends Actual{constructor(key,options){if(key!=='sk_test_local_synthetic')throw Error('synthetic key required');super(key,options);
 this.accounts.retrieve=async()=>({id:'acct_casefixture'});
 this.prices.create=async(body,opts)=>{let p=keys.get(opts.idempotencyKey);if(!p){p={id:id('price_'),unit_amount:body.unit_amount,currency:body.currency,livemode:false,metadata:body.metadata};keys.set(opts.idempotencyKey,p);prices.set(p.id,p);log({boundary:'price',key:opts.idempotencyKey});}return {...p};};
 this.paymentLinks.create=async(body,opts)=>{let l=keys.get(opts.idempotencyKey);if(!l){const linkId=id('plink_');l={id:linkId,url:'https://buy.stripe.com/'+linkId,active:true,livemode:false,metadata:body.metadata,price:body.line_items[0].price};keys.set(opts.idempotencyKey,l);links.set(l.id,l);log({boundary:'link',key:opts.idempotencyKey});}if(['a0000000-0000-4000-8000-000000000006','a0000000-0000-4000-8000-000000000013'].includes(body.metadata.projectId)){global.__linkLoss??=new Set();if(!global.__linkLoss.has(body.metadata.projectId)){global.__linkLoss.add(body.metadata.projectId);throw Error('synthetic response loss after create');}}return {...l};};
 this.paymentLinks.retrieve=async id=>{if(!links.has(id))throw Error('unknown synthetic link');return {...links.get(id)};};
 this.paymentLinks.listLineItems=async id=>({has_more:false,data:[{quantity:1,price:prices.get(links.get(id).price)}]});
 this.paymentLinks.update=async(id,body)=>{const l=links.get(id);if(!l)throw Error('unknown synthetic link');Object.assign(l,body);return {...l};};
 this.checkout.sessions.expire=async id=>({id,status:'expired'});
 this.checkout.sessions.list=async()=>({has_more:false,data:[]});
 }}FixtureStripe.default=FixtureStripe;FixtureStripe.Stripe=FixtureStripe;return FixtureStripe;
};
