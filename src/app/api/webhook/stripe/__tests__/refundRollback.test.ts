import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), dispatch: vi.fn(), markPaid: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: () => ({ rpc: m.rpc, from: m.from }) }));
vi.mock('@/features/natori/server/trustedNatoriOwner', () => ({ resolveTrustedNatoriOwnerId: () => ({ kind: 'ok', ownerId: 'b5e53100-c997-47a4-8e49-cf5ea79f12b3' }) }));
vi.mock('@/features/natori/server/acceptanceNotifications', () => ({ dispatchAcceptanceNotifications: m.dispatch }));
vi.mock('@/features/natori/server/orderMailService', () => ({ markNatoriCommissionPaid: m.markPaid }));
vi.mock('@/lib/coa/server', () => ({ issueReissueLink: vi.fn() }));
vi.mock('@/lib/constants', () => ({ getSiteUrl: () => 'https://example.invalid', calcFee: vi.fn(), calcReward: vi.fn() }));

const secret = 'whsec_phase2d_rollback_synthetic_only';
const signer = new Stripe('sk_test_phase2d_rollback_synthetic_only');
let post: typeof import('../route').POST;
let receive: typeof import('@/features/natori/server/paymentEventService').receiveNatoriPaymentEvent;

function event(type = 'refund.created', kind?: string): Stripe.Event {
  return { id: 'evt_phase2d_rollback_synthetic', object: 'event', type, livemode: false, created: 1790899200,
    data: { object: { id: 're_phase2d_rollback_synthetic', object: 'refund', amount: 3000, currency: 'jpy', status: 'succeeded',
      payment_intent: 'pi_phase2d_rollback_synthetic', charge: 'ch_phase2d_rollback_synthetic', metadata: kind ? { kind } : {} } } } as unknown as Stripe.Event;
}

function request(value: Stripe.Event, invalid = false): NextRequest {
  const payload = JSON.stringify(value), signature = invalid ? 'invalid' : signer.webhooks.generateTestHeaderString({ payload, secret });
  return new NextRequest('http://localhost/api/webhook/stripe', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } });
}

beforeAll(async () => {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_phase2d_rollback_synthetic_only');
  post = (await import('../route')).POST;
  receive = (await import('@/features/natori/server/paymentEventService')).receiveNatoriPaymentEvent;
  vi.unstubAllEnvs();
});
beforeEach(() => {
  vi.clearAllMocks(); m.rpc.mockReset();
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', secret); vi.stubEnv('NATORI_PAYMENT_INTEGRITY_ENABLED', '1');
  vi.stubEnv('NATORI_REFUND_LEDGER_ENABLED', '0'); vi.stubEnv('NATORI_REFUND_LEDGER_READ_ENABLED', '1');
  vi.stubEnv('NATORI_STRIPE_MODE', 'test'); vi.stubEnv('ADMIN_API_TOKEN', '');
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('signed refund arrival while the consumer is paused', () => {
  it.each(['refund.created', 'refund.updated', 'refund.failed', 'charge.refund.updated', 'charge.refunded'])('keeps %s retryable before DB/inbox effects', async type => {
    const response = await post(request(event(type)));
    expect(response.status).toBe(503); expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toEqual({ ok: false, received: false, result: 'refund_consumer_paused' });
    expect(m.rpc).not.toHaveBeenCalled(); expect(m.from).not.toHaveBeenCalled(); expect(m.dispatch).not.toHaveBeenCalled();
  });
  it.each(['aura', 'card', 'gallery', 'entry_plan'])('preserves explicit %s refund dispatch', async kind => {
    const response = await post(request(event('refund.created', kind)));
    expect(response.status).toBe(200); expect(m.rpc).not.toHaveBeenCalled(); expect(m.from).not.toHaveBeenCalled();
  });
  it('also protects read-on rollback if payment integrity is switched off', async () => {
    vi.stubEnv('NATORI_PAYMENT_INTEGRITY_ENABLED', '0');
    expect((await post(request(event('refund.created', 'natori_commission')))).status).toBe(503);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each(['0', '1'])('retains both refund flags OFF with integrity=%s', async integrity => {
    vi.stubEnv('NATORI_PAYMENT_INTEGRITY_ENABLED', integrity); vi.stubEnv('NATORI_REFUND_LEDGER_READ_ENABLED', '0');
    expect((await post(request(event()))).status).toBe(200); expect(m.rpc).not.toHaveBeenCalled();
  });
  it('verifies the real synthetic SDK signature before rollback handling', async () => {
    const response = await post(request(event(), true)); expect(response.status).toBe(400);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('guards direct consumer calls against sending refund objects to checkout v1', async () => {
    expect(await receive(event())).toEqual({ status: 503, result: 'refund_consumer_paused' });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it('after restore, the same signed metadata-free event reaches v2 with original financial identity', async () => {
    const value = event(); expect((await post(request(value))).status).toBe(503);
    vi.stubEnv('NATORI_REFUND_LEDGER_ENABLED', '1');
    m.rpc.mockResolvedValueOnce({ data: [{ result: 'claimed', generation: 1, notification_ids: [] }], error: null })
      .mockResolvedValueOnce({ data: [{ result: 'completed', notification_ids: [] }], error: null })
      .mockResolvedValueOnce({ data: [{ result: 'completed', notification_ids: [] }], error: null });
    expect((await post(request(value))).status).toBe(200); expect((await post(request(value))).status).toBe(200);
    expect(m.rpc.mock.calls.map(call => call[0])).toEqual(['natori_stripe_event_claim_v1', 'natori_stripe_event_complete_v2', 'natori_stripe_event_claim_v1']);
    expect(m.rpc.mock.calls[0][1].p_request).toMatchObject({ kind: 'refund', projectId: null,
      refunds: [{ refundId: 're_phase2d_rollback_synthetic', projectId: null, paymentIntentId: 'pi_phase2d_rollback_synthetic', chargeId: 'ch_phase2d_rollback_synthetic' }] });
    expect(m.rpc.mock.calls.every(call => call[0] !== 'natori_stripe_event_complete_v1')).toBe(true);
  });
});
