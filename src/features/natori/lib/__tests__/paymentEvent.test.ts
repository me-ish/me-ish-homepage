import {describe,it,expect} from "vitest";
import type Stripe from "stripe";
import {normalizeNatoriPaymentEvent} from "../paymentEvent";
const projectId="aaaabbbb-cccc-4ddd-8eee-ffffffffffff",quoteId="11112222-3333-4444-8555-666677778888";
const event=(extra:Record<string,unknown>={})=>({account:undefined,data:{object:{id:"cs_test_fixture",payment_status:"paid",currency:"jpy",amount_total:12000,payment_intent:"pi_test_fixture",metadata:{projectId,quoteId,kind:"natori_commission"},...extra}}}) as unknown as Stripe.Event;
describe("Natori payment event identity",()=>{
 it("retains financial identity and excludes unrelated customer data",()=>{
  const normalized=normalizeNatoriPaymentEvent(event({customer_email:"private@synthetic.invalid",customer_details:{address:{line1:"DO NOT PERSIST"}}}));
  expect(normalized.account).toBe("platform");expect(normalized.request).toEqual({sessionId:"cs_test_fixture",projectId,quoteId,paymentStatus:"paid",currency:"jpy",amount:12000,paymentIntentId:"pi_test_fixture"});
  expect(JSON.stringify(normalized)).not.toContain("private@");expect(JSON.stringify(normalized)).not.toContain("DO NOT PERSIST");
 });
 it("keeps expanded and scalar payment-intent identities equal",()=>{expect(normalizeNatoriPaymentEvent(event({payment_intent:{id:"pi_test_fixture"}}))).toEqual(normalizeNatoriPaymentEvent(event()));});
 it("preserves the frozen Phase 2B request even when an expanded intent has a charge",()=>{
  const expanded=event({payment_intent:{id:"pi_test_fixture",latest_charge:"ch_test_fixture"}});
  expect(normalizeNatoriPaymentEvent(expanded)).toEqual(normalizeNatoriPaymentEvent(event()));
  expect(normalizeNatoriPaymentEvent(expanded,{includeRefundMapping:false})).toEqual(normalizeNatoriPaymentEvent(event()));
  expect(normalizeNatoriPaymentEvent(expanded,{includeRefundMapping:true}).request).toMatchObject({paymentIntentId:"pi_test_fixture",chargeId:"ch_test_fixture"});
 });
 it("keeps old rejected currency identity stable with refund writes off",()=>{
  expect(normalizeNatoriPaymentEvent(event({currency:"INVALID"})).request).toMatchObject({currency:"invalid"});
  expect(normalizeNatoriPaymentEvent(event({currency:"INVALID"}),{includeRefundMapping:true}).request).toMatchObject({currency:null});
 });
 it("does not clamp invalid money or accept malformed project IDs",()=>{const normalized=normalizeNatoriPaymentEvent(event({amount_total:1.5,metadata:{projectId:"invalid",quoteId:"invalid"}}));expect(normalized.request).toMatchObject({amount:null,projectId:null,quoteId:null});});
});
