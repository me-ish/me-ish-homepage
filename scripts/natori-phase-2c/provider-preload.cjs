// Fixture-only SDK adapter in the disposable Next process. No product code imports this.
if(process.env.PHASE_2C_BROWSER!=='ephemeral')throw new Error('EPHEMERAL_REQUIRED');
require('/browser-test/provider-preload.cjs');
const Module=require('node:module'),crypto=require('node:crypto'),load=Module._load;
const prices=new Map(),links=new Map(),keys=new Map();
const id=prefix=>prefix+crypto.randomUUID().replaceAll('-','');
Module._load=function(request,parent,isMain){
 const Actual=load.apply(this,arguments);if(request!=='stripe')return Actual;
 class FixtureStripe extends Actual{
  constructor(key,options){if(typeof key!=='string'||!key.startsWith('sk_test_'))throw new Error('FIXTURE_TEST_MODE_REQUIRED');super(key,options);
   this.accounts.retrieve=async()=>{console.log('PHASE2C_FIXTURE_ADAPTER');return {id:'acct_phase2cfixture'};};
   this.prices.create=async(body,opts)=>{let object=keys.get(opts.idempotencyKey);if(!object){object={id:id('price_'),unit_amount:body.unit_amount,currency:body.currency};keys.set(opts.idempotencyKey,object);prices.set(object.id,object);}return {...object};};
   this.paymentLinks.create=async(body,opts)=>{let link=keys.get(opts.idempotencyKey);if(!link){const linkId=id('plink_');link={id:linkId,url:'https://buy.stripe.com/'+linkId,active:true,livemode:false,metadata:body.metadata,price:body.line_items[0].price};keys.set(opts.idempotencyKey,link);links.set(link.id,link);}return {...link};};
   this.paymentLinks.list=async(params={})=>{const all=[...links.values()],after=params.starting_after;
    const index=after?all.findIndex(link=>link.id===after):-1;if(after&&index<0)throw new Error('FIXTURE_CURSOR_UNKNOWN');
    const start=index+1,limit=params.limit??10,data=all.slice(start,start+limit);return {has_more:start+data.length<all.length,data:data.map(link=>({...link}))};};
   this.paymentLinks.retrieve=async(linkId)=>{const link=links.get(linkId);if(!link)throw new Error('FIXTURE_LINK_UNKNOWN');return {...link};};
   this.paymentLinks.listLineItems=async(linkId)=>{const link=links.get(linkId);if(!link)throw new Error('FIXTURE_LINK_UNKNOWN');return {has_more:false,data:[{quantity:1,price:prices.get(link.price)}]};};
   this.paymentLinks.update=async(linkId,body)=>{const link=links.get(linkId);if(!link)throw new Error('FIXTURE_LINK_UNKNOWN');link.active=body.active;return {...link};};
   this.checkout.sessions.list=async()=>({has_more:false,data:[]});this.checkout.sessions.expire=async(sessionId)=>({id:sessionId,status:'expired'});
  }
 }
 FixtureStripe.default=FixtureStripe;FixtureStripe.Stripe=FixtureStripe;return FixtureStripe;
};
