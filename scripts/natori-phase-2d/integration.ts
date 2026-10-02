import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import Stripe from 'stripe';
import { NextRequest } from 'next/server';
import type { Database, Json } from '../../src/types/supabase';
import type { NatoriProject } from '../../src/features/natori/types/projects';

type LockFixtureDatabase = Omit<Database, 'public'> & { public: Omit<Database['public'], 'Functions'> & {
  Functions: Database['public']['Functions'] & {
    phase2d_hold_then_complete_v1: { Args: { p_owner: string; p_project: string; p_event: string; p_token: string; p_generation: number; p_seconds: number; p_legacy: boolean }; Returns: { result: string; notification_ids: string[] }[] };
    phase2d_project_is_held_v1: { Args: { p_project: string }; Returns: boolean };
    phase2d_financial_activity_v1: { Args: { p_waiting: boolean }; Returns: boolean };
    phase2d_payment_is_available_v1: { Args: { p_owner: string; p_project: string }; Returns: boolean };
  }
} };

const check = (value: unknown, code: string) => { if (!value) throw new Error(code); };
const tests: { name: string; status: string; code?: string }[] = [];
async function test(name: string, run: () => Promise<void>) {
  try { await run(); tests.push({ name, status: 'passed' }); console.log(`PASS phase2d/${name}`); }
  catch (error) { const code = error instanceof Error && /^[A-Z_0-9]+$/.test(error.message) ? error.message : 'ASSERTION_FAILED';
    tests.push({ name, status: 'failed', code }); console.log(`FAIL phase2d/${name} ${code}`); }
}

async function main() {
  const { origin } = JSON.parse(readFileSync('/runtime/network.json', 'utf8')) as { origin: string };
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), 'DESTINATION_REJECTED');
  const keys = JSON.parse(readFileSync('/runtime/credentials.json', 'utf8')) as { service: string; anon: string };
  const db = createClient<Database>(origin, keys.service, { auth: { persistSession: false } });
  const direct = globalThis.fetch; let blockCount = 0, loseComplete = false, refundSummaryCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== origin) { blockCount++; throw new Error('DESTINATION_REJECTED'); }
    if (url.pathname.endsWith('/rpc/natori_refund_summaries_v1')) refundSummaryCalls++;
    const response = await direct(input, init);
    if (loseComplete && url.pathname.endsWith('/rpc/natori_stripe_event_complete_v2')) {
      loseComplete = false; check(response.ok, 'COMMITTED_BEFORE_LOSS'); return new Response('{}', { status: 503 });
    }
    return response;
  };
  try {
    const lockDb = createClient<LockFixtureDatabase>(origin, keys.service, { auth: { persistSession: false } });
    const auth = await db.auth.admin.createUser({ email: 'owner@phase2d.invalid', password: randomBytes(32).toString('hex'), email_confirm: true });
    check(auth.data.user, 'AUTH_FIXTURE'); const owner = auth.data.user!.id;
    const secret = 'whsec_' + randomBytes(32).toString('hex');
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service,
      STRIPE_SECRET_KEY: 'sk_test_' + randomBytes(32).toString('hex'), STRIPE_WEBHOOK_SECRET: secret,
      NATORI_OWNER_USER_ID: owner, NATORI_PAYMENT_INTEGRITY_ENABLED: '1', NATORI_REFUND_LEDGER_ENABLED: '1', NATORI_STRIPE_MODE: 'test',
      NATORI_ACCEPTANCE_OUTBOX_ENABLED: '1', NATORI_NOTIFICATION_SENDING_ENABLED: '0', RESEND_API_KEY: '', ADMIN_API_TOKEN: '' });
    const route = await import('../../src/app/api/webhook/stripe/route');
    const { normalizeNatoriPaymentEvent } = await import('../../src/features/natori/lib/paymentEvent');
    const results = await import('../../src/features/natori/lib/results');
    const { rowToProject } = await import('../../src/features/natori/data/supabaseProjects');
    const { loadNatoriRefundSummaries } = await import('../../src/features/natori/server/refundSummaryService');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    let created = Math.floor(Date.now() / 1000) - 2000;
    async function setup(paid = true) {
      const p = await db.from('natori_projects').insert({ user_id: owner, title: 'Refund fixture', client_name: 'Synthetic', client_email: 'client@phase2d.invalid',
        type: 'illustration', status: 'inquiry', amount: 12000, quoted_amount: 12000 }).select('id').single(); check(!p.error && p.data, 'PROJECT');
      const q = await db.from('natori_quotes').insert({ project_id: p.data!.id, user_id: owner, version: 1, title: 'Refund fixture', client_name: 'Synthetic',
        to_email: 'client@phase2d.invalid', amount: 12000, subject: 'Quote', body_snapshot: 'Synthetic', token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        expires_at: new Date(Date.now() + 86400000).toISOString(), accepted_at: new Date().toISOString() }).select('id').single(); check(!q.error && q.data, 'QUOTE');
      check(!(await db.from('natori_projects').update({ status: 'awaiting_payment', payment_quote_id: q.data!.id, active_quote_id: q.data!.id,
        quote_accepted_at: new Date().toISOString(), quote_accepted_amount: 12000 }).eq('id', p.data!.id)).error, 'PAYMENT_QUOTE');
      const fixture = { projectId: p.data!.id, quoteId: q.data!.id, sessionId: 'cs_test_' + randomUUID().replaceAll('-', ''),
        intentId: 'pi_test_' + randomUUID().replaceAll('-', ''), chargeId: 'ch_test_' + randomUUID().replaceAll('-', '') };
      if (paid) check((await post(payment(fixture))).status === 200, 'PAYMENT_ACK');
      return fixture;
    }
    type Fixture = Awaited<ReturnType<typeof setup>>;
    function payment(fixture: Fixture): Stripe.Event {
      return { id: 'evt_' + randomUUID(), type: 'checkout.session.completed', livemode: false, created: ++created, data: { object: {
        id: fixture.sessionId, payment_status: 'paid', status: 'complete', amount_total: 12000, currency: 'jpy', payment_intent: { id: fixture.intentId, latest_charge: fixture.chargeId },
        metadata: { kind: 'natori_commission', projectId: fixture.projectId, quoteId: fixture.quoteId },
      } } } as unknown as Stripe.Event;
    }
    function refund(fixture: Fixture, options: { id?: string; amount?: number; status?: string; currency?: string; projectId?: string | null;
      intentId?: string | null; chargeId?: string | null; kind?: string; eventCreated?: number; eventType?: string } = {}): Stripe.Event {
      return { id: 'evt_' + randomUUID(), type: options.eventType ?? 'refund.created', livemode: false, created: options.eventCreated ?? ++created, data: { object: {
        id: options.id ?? 're_' + randomUUID(), amount: options.amount ?? 3000, currency: options.currency ?? 'jpy', status: options.status ?? 'succeeded',
        payment_intent: options.intentId === undefined ? fixture.intentId : options.intentId, charge: options.chargeId === undefined ? fixture.chargeId : options.chargeId,
        metadata: options.projectId === null ? {} : { kind: options.kind ?? 'natori_commission', projectId: options.projectId ?? fixture.projectId },
      } } } as unknown as Stripe.Event;
    }
    async function post(event: Stripe.Event, badSignature = false) {
      const payload = JSON.stringify(event), signature = badSignature ? 'invalid' : stripe.webhooks.generateTestHeaderString({ payload, secret });
      return route.POST(new NextRequest('http://localhost/api/webhook/stripe', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));
    }
    async function ledger(projectId: string) {
      const response = await db.from('natori_refund_ledger').select('*').eq('project_id', projectId); check(!response.error, 'LEDGER'); return response.data!;
    }
    async function summary(projectId: string) {
      const response = await db.rpc('natori_refund_summaries_v1', { p_owner_id: owner, p_project_ids: [projectId] }); check(!response.error && response.data?.[0], 'SUMMARY');
      return response.data![0].summary as { available: boolean; originalMapped: boolean; confirmedAmount: number | null; pendingCount: number; reviewCount: number };
    }
    async function facts(projectId: string) {
      const response = await db.from('natori_projects').select('status,next_action,paid_at,paid_amount,payment_confirmed_at,completed_at,deleted_at,stripe_payment_session_id').eq('id', projectId).single();
      check(!response.error && response.data, 'FACTS'); return response.data!;
    }
    async function notices(projectId: string) {
      const response = await db.from('natori_notification_jobs').select('id,purpose,status').eq('project_id', projectId).in('purpose', ['refund_confirmed_artist', 'refund_review_artist']);
      check(!response.error, 'NOTICES'); return response.data!;
    }
    async function claim(event: Stripe.Event, token: string) {
      const input = normalizeNatoriPaymentEvent(event, { includeRefundMapping: true });
      return db.rpc('natori_stripe_event_claim_v1', { p_owner_id: owner, p_account: input.account, p_live: event.livemode,
        p_event_id: event.id, p_type: event.type, p_request: input.request, p_claim_token: token });
    }
    async function complete(event: Stripe.Event, token: string, generation: number, ownerId = owner) {
      return db.rpc('natori_stripe_event_complete_v2', { p_owner_id: ownerId, p_account: 'platform', p_live: false,
        p_event_id: event.id, p_claim_token: token, p_generation: generation });
    }
    await test('full-refund-preserves-original-money-business-and-delivery-facts', async () => {
      const fixture = await setup(); check(!(await db.from('natori_projects').update({ status: 'completed', completed_at: new Date().toISOString(), next_action: 'Keep completed' }).eq('id', fixture.projectId)).error, 'COMPLETED_SETUP');
      const before = await facts(fixture.projectId); check((await post(refund(fixture, { amount: 12000 }))).status === 200, 'REFUND_ACK');
      check((await summary(fixture.projectId)).confirmedAmount === 12000, 'FULL_REFUND'); check(JSON.stringify(before) === JSON.stringify(await facts(fixture.projectId)), 'FACTS_UNCHANGED');
      check((await notices(fixture.projectId)).length === 1, 'ONE_ARTIST_NOTICE');
    });
    await test('multiple-partials-count-each-refund-id-once', async () => {
      const fixture = await setup(); const a = refund(fixture, { amount: 3000 }), b = refund(fixture, { amount: 2000 });
      check((await post(a)).status === 200 && (await post(b)).status === 200, 'PARTIAL_ACK');
      check((await ledger(fixture.projectId)).length === 2 && (await summary(fixture.projectId)).confirmedAmount === 5000, 'PARTIAL_TOTAL');
    });
    await test('duplicate-event-and-new-event-same-refund-have-one-effect', async () => {
      const fixture = await setup(), event = refund(fixture);
      check((await post(event)).status === 200 && (await post(event)).status === 200 && (await post({ ...event, id: 'evt_' + randomUUID() })).status === 200, 'DUPLICATE_ACK');
      check((await ledger(fixture.projectId)).length === 1 && (await summary(fixture.projectId)).confirmedAmount === 3000 && (await notices(fixture.projectId)).length === 1, 'IDEMPOTENT');
    });
    await test('refund-before-payment-is-visible-then-reconciles-once', async () => {
      const fixture = await setup(false), event = refund(fixture);
      check((await post(event)).status === 200, 'EARLY_ACK'); check((await summary(fixture.projectId)).confirmedAmount === 0, 'EARLY_NOT_COUNTED');
      check((await ledger(fixture.projectId))[0]?.resolution === 'unmatched', 'UNMATCHED_SAVED');
      const attention = await db.rpc('natori_payment_attention_v1', { p_owner_id: owner });
      check(!attention.error && Array.isArray(attention.data) && attention.data.some(item => item !== null && typeof item === 'object'
        && !Array.isArray(item) && item.projectId === fixture.projectId && item.reason === 'original_payment_unmatched'), 'EARLY_VISIBLE');
      check((await post(payment(fixture))).status === 200 && (await post(event)).status === 200, 'PAYMENT_RECONCILES');
      check((await summary(fixture.projectId)).confirmedAmount === 3000 && (await ledger(fixture.projectId))[0]?.resolution === 'resolved', 'ONCE_RECONCILED');
    });
    await test('metadata-free-refund-before-payment-keeps-unclassified-fact', async () => {
      const fixture = await setup(false), event = refund(fixture, { projectId: null }); check((await post(event)).status === 200, 'UNKNOWN_ACK');
      const rows = await db.from('natori_refund_ledger').select('project_id,resolution').eq('refund_id', (event.data.object as Stripe.Refund).id);
      check(rows.data?.[0]?.project_id === null && rows.data[0].resolution === 'unmatched', 'NO_INFERRED_PROJECT');
      check((await post(payment(fixture))).status === 200 && (await summary(fixture.projectId)).confirmedAmount === 3000, 'KNOWN_PAYMENT_RECONCILES');
    });
    await test('pending-to-succeeded-only-counts-after-confirmation', async () => {
      const fixture = await setup(), event = refund(fixture, { status: 'pending' }); check((await post(event)).status === 200, 'PENDING_ACK');
      check((await summary(fixture.projectId)).confirmedAmount === 0 && (await summary(fixture.projectId)).pendingCount === 1, 'PENDING_EXCLUDED');
      check((await post(refund(fixture, { id: (event.data.object as Stripe.Refund).id, status: 'succeeded' }))).status === 200, 'SUCCESS_ACK');
      check((await summary(fixture.projectId)).confirmedAmount === 3000 && (await summary(fixture.projectId)).pendingCount === 0, 'SUCCESS_COUNTED');
    });
    await test('pending-to-failed-and-requires-action-never-count', async () => {
      const fixture = await setup(), event = refund(fixture, { status: 'pending' }); await post(event);
      check((await post(refund(fixture, { id: (event.data.object as Stripe.Refund).id, status: 'failed', eventType: 'refund.failed' }))).status === 200, 'FAILED_ACK');
      await post(refund(fixture, { status: 'requires_action' })); check((await summary(fixture.projectId)).confirmedAmount === 0, 'UNCONFIRMED_EXCLUDED');
      check((await summary(fixture.projectId)).reviewCount === 1 && (await summary(fixture.projectId)).pendingCount === 1, 'STATES_VISIBLE');
    });
    await test('newer-failure-removes-confirmed-refund-with-audit-time-retained', async () => {
      const fixture = await setup(), event = refund(fixture); await post(event); const before = await facts(fixture.projectId);
      await post(refund(fixture, { id: (event.data.object as Stripe.Refund).id, status: 'failed', eventType: 'refund.failed' }));
      check((await summary(fixture.projectId)).confirmedAmount === 0 && (await ledger(fixture.projectId))[0].confirmed_at !== null, 'FAILED_REMOVED_AUDIT_RETAINED');
      check(JSON.stringify(before) === JSON.stringify(await facts(fixture.projectId)), 'FACTS_UNCHANGED');
    });
    await test('old-pending-does-not-overwrite-later-success', async () => {
      const fixture = await setup(), event = refund(fixture); await post(event);
      await post(refund(fixture, { id: (event.data.object as Stripe.Refund).id, status: 'pending', eventCreated: event.created - 1 }));
      check((await summary(fixture.projectId)).confirmedAmount === 3000 && (await ledger(fixture.projectId))[0].provider_status === 'succeeded', 'STALE_IGNORED');
    });
    await test('same-second-terminal-conflict-is-visible-review-not-guessed', async () => {
      const fixture = await setup(), event = refund(fixture); await post(event);
      await post(refund(fixture, { id: (event.data.object as Stripe.Refund).id, status: 'failed', eventCreated: event.created, eventType: 'refund.failed' }));
      check((await summary(fixture.projectId)).confirmedAmount === 0 && (await ledger(fixture.projectId))[0].review_reason === 'refund_state_order_uncertain', 'ORDER_REVIEW');
    });
    for (const pending of ['pending', 'requires_action']) for (const successFirst of [true, false]) {
      await test(`same-second-${pending}-success-${successFirst ? 'first' : 'last'}-requires-review`, async () => {
        const fixture = await setup(), before = await facts(fixture.projectId);
        const first = refund(fixture, { status: successFirst ? 'succeeded' : pending });
        await post(first);
        const id = (first.data.object as Stripe.Refund).id;
        await post(refund(fixture, { id, status: successFirst ? pending : 'succeeded', eventCreated: first.created }));
        const row = (await ledger(fixture.projectId))[0], financial = await summary(fixture.projectId);
        check(row.review_reason === 'refund_state_order_uncertain' && financial.confirmedAmount === 0 && financial.reviewCount === 1, 'SAME_SECOND_NOT_GUESSED');
        const later = successFirst ? pending : 'succeeded';
        await post(refund(fixture, { id, status: later, eventCreated: first.created + 1 }));
        const resolved = (await ledger(fixture.projectId))[0];
        check(resolved.resolution === 'resolved' && resolved.review_reason === null && resolved.provider_status === later, 'LATER_OBSERVATION_RESOLVES');
        check((await summary(fixture.projectId)).confirmedAmount === (later === 'succeeded' ? 3000 : 0), 'LATER_FINANCIAL_STATE');
        check(JSON.stringify(before) === JSON.stringify(await facts(fixture.projectId)), 'ORDER_FACTS_UNCHANGED');
      });
    }
    async function waitForProjectBarrier(projectId: string) {
      for (let attempt = 0; attempt < 150; attempt++) {
        const probe = await lockDb.rpc('phase2d_project_is_held_v1', { p_project: projectId });
        check(!probe.error, 'PROJECT_BARRIER_PROBE'); if (probe.data === true) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error('PROJECT_BARRIER_NOT_ACQUIRED');
    }
    async function waitForFinancialBarrier(waiting: boolean) {
      for (let attempt = 0; attempt < 150; attempt++) {
        const probe = await lockDb.rpc('phase2d_financial_activity_v1', { p_waiting: waiting });
        check(!probe.error, 'FINANCIAL_BARRIER_PROBE'); if (probe.data === true) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error('FINANCIAL_BARRIER_NOT_ACQUIRED');
    }
    for (const directReconcile of [false, true]) {
      await test(`project-first-${directReconcile ? 'direct-reconcile' : 'charge-only-refund'}-vs-duplicate-checkout`, async () => {
        const fixture = await setup(), event = payment(fixture), token = randomUUID(), claimed = await claim(event, token);
        check(!claimed.error && claimed.data?.[0]?.result === 'claimed', 'DUPLICATE_CLAIM');
        const pending = refund(fixture, { intentId: null });
        if (directReconcile) await post(pending);
        const before = await facts(fixture.projectId);
        const holding = Promise.resolve(lockDb.rpc('phase2d_hold_then_complete_v1', { p_owner: owner, p_project: fixture.projectId,
          p_event: event.id, p_token: token, p_generation: claimed.data![0].generation, p_seconds: 3, p_legacy: false }));
        let worker: Promise<unknown> | null = null;
        try {
          await waitForProjectBarrier(fixture.projectId);
          worker = directReconcile
            ? Promise.resolve(db.rpc('natori_refund_reconcile_v1', { p_owner_id: owner, p_account: 'platform', p_live: false,
                p_refund_id: (pending.data.object as Stripe.Refund).id })).then(response => { check(!response.error, 'DIRECT_RECONCILE_COMPLETED'); })
            : post(pending).then(response => { check(response.status === 200, 'RACING_REFUND_COMPLETED'); });
          await waitForFinancialBarrier(true);
          const free = await lockDb.rpc('phase2d_payment_is_available_v1', { p_owner: owner, p_project: fixture.projectId });
          check(!free.error && free.data === true, 'PAYMENT_NOT_LOCKED_BELOW_PROJECT_WAIT');
          const outcome = await holding; check(!outcome.error && outcome.data?.[0]?.result === 'completed', 'DUPLICATE_COMPLETED_WITHOUT_DEADLOCK');
          await worker;
          check((await summary(fixture.projectId)).confirmedAmount === 3000 && (await notices(fixture.projectId)).length === 1, 'RACE_REFUND_ONCE');
          check(JSON.stringify(before) === JSON.stringify(await facts(fixture.projectId)), 'RACE_FACTS_UNCHANGED');
        } finally { await Promise.allSettled([holding, ...(worker ? [worker] : [])]); }
      });
    }
    await test('gate-off-v1-payment-and-v2-refund-keep-project-first-order', async () => {
      const fixture = await setup(), event = payment(fixture), token = randomUUID();
      const input = normalizeNatoriPaymentEvent(event), core = { ...input.request as Record<string, Json | undefined> }; delete core.chargeId;
      const claimed = await db.rpc('natori_stripe_event_claim_v1', { p_owner_id: owner, p_account: input.account, p_live: false,
        p_event_id: event.id, p_type: event.type, p_request: core, p_claim_token: token });
      check(!claimed.error && claimed.data?.[0]?.result === 'claimed', 'GATE_OFF_CLAIM');
      const before = await facts(fixture.projectId);
      const holding = Promise.resolve(lockDb.rpc('phase2d_hold_then_complete_v1', { p_owner: owner, p_project: fixture.projectId,
        p_event: event.id, p_token: token, p_generation: claimed.data![0].generation, p_seconds: 3, p_legacy: true }));
      let worker: Promise<unknown> | null = null;
      try {
        await waitForProjectBarrier(fixture.projectId);
        worker = post(refund(fixture, { intentId: null })).then(response => { check(response.status === 200, 'GATE_OFF_RACING_REFUND'); });
        await waitForFinancialBarrier(false);
        const free = await lockDb.rpc('phase2d_payment_is_available_v1', { p_owner: owner, p_project: fixture.projectId });
        check(!free.error && free.data === true, 'GATE_OFF_PAYMENT_NOT_LOCKED_BELOW_PROJECT_WAIT');
        const outcome = await holding; check(!outcome.error && outcome.data?.[0]?.result === 'completed', 'GATE_OFF_PAYMENT_COMPLETED');
        await worker; check((await summary(fixture.projectId)).confirmedAmount === 3000, 'GATE_OFF_REFUND_ONCE');
        check(JSON.stringify(before) === JSON.stringify(await facts(fixture.projectId)), 'GATE_OFF_FACTS_UNCHANGED');
      } finally { await Promise.allSettled([holding, ...(worker ? [worker] : [])]); }
    });
    function sameRequest(left: unknown, right: Record<string, Json | undefined>): boolean {
      return left !== null && typeof left === 'object' && !Array.isArray(left)
        && Object.keys(left).length === Object.keys(right).length
        && Object.entries(right).every(([key, value]) => Object.is((left as Record<string, unknown>)[key], value));
    }
    await test('legacy-processing-expanded-charge-replay-preserves-frozen-request', async () => {
      const fixture = await setup(false), event = payment(fixture), token = randomUUID();
      const input = normalizeNatoriPaymentEvent(event, { includeRefundMapping: true });
      const original = { ...input.request as Record<string, Json | undefined> }; delete original.chargeId;
      const seeded = await db.rpc('natori_stripe_event_claim_v1', { p_owner_id: owner, p_account: input.account, p_live: false,
        p_event_id: event.id, p_type: event.type, p_request: original, p_claim_token: token });
      check(!seeded.error && seeded.data?.[0]?.result === 'claimed', 'LEGACY_PROCESSING_SEEDED');
      const busy = await claim(event, randomUUID()); check(!busy.error && busy.data?.[0]?.result === 'busy', 'LEGACY_BUSY_NOT_CONFLICT');
      check(!(await db.from('natori_stripe_event_inbox').update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq('event_id', event.id)).error, 'LEGACY_LEASE_EXPIRED');
      check((await post(event)).status === 200 && (await facts(fixture.projectId)).paid_amount === 12000, 'LEGACY_PROCESSING_COMPLETED');
      check((await post(event)).status === 200, 'LEGACY_COMPLETED_REPLAY');
      const stored = await db.from('natori_stripe_event_inbox').select('request,status,error_code').eq('event_id', event.id).single();
      check(!stored.error && stored.data?.status === 'completed' && stored.data.error_code === null
        && sameRequest(stored.data.request, original), 'LEGACY_REQUEST_FROZEN');
      check((await db.from('natori_payment_transactions').select('id').eq('stripe_session_id', fixture.sessionId)).data?.length === 1, 'LEGACY_PAYMENT_ONCE');
    });
    await test('optional-charge-absence-in-rollback-replay-keeps-known-identity', async () => {
      const fixture = await setup(), event = payment(fixture), token = randomUUID(), seeded = await claim(event, token);
      check(!seeded.error && seeded.data?.[0]?.result === 'claimed', 'MAPPED_EVENT_CLAIM');
      check((await complete(event, token, seeded.data![0].generation)).data?.[0]?.result === 'completed', 'MAPPED_EVENT_COMPLETED');
      const input = normalizeNatoriPaymentEvent(event, { includeRefundMapping: true }), core = { ...input.request as Record<string, Json | undefined> }; delete core.chargeId;
      const replay = await db.rpc('natori_stripe_event_claim_v1', { p_owner_id: owner, p_account: input.account, p_live: false,
        p_event_id: event.id, p_type: event.type, p_request: core, p_claim_token: randomUUID() });
      check(!replay.error && replay.data?.[0]?.result === 'completed', 'ROLLBACK_ABSENCE_NOT_CONFLICT');
      const stored = await db.from('natori_stripe_event_inbox').select('request').eq('event_id', event.id).single();
      check(!stored.error && sameRequest(stored.data?.request, input.request as Record<string, Json | undefined>), 'KNOWN_REQUEST_FROZEN');
    });
    await test('legacy-optional-charge-compatibility-does-not-ignore-core-conflicts', async () => {
      const fixture = await setup(false);
      for (const changed of [{ amount: 12001 }, { currency: 'usd' }, { quoteId: randomUUID() }, { paymentIntentId: 'pi_other' }]) {
        const event = payment(fixture), token = randomUUID(), input = normalizeNatoriPaymentEvent(event, { includeRefundMapping: true });
        const original = { ...input.request as Record<string, Json | undefined> }; delete original.chargeId;
        const seeded = await db.rpc('natori_stripe_event_claim_v1', { p_owner_id: owner, p_account: input.account, p_live: false,
          p_event_id: event.id, p_type: event.type, p_request: original, p_claim_token: token });
        check(!seeded.error, 'LEGACY_CORE_SEEDED');
        const conflict = await db.rpc('natori_stripe_event_claim_v1', { p_owner_id: owner, p_account: input.account, p_live: false,
          p_event_id: event.id, p_type: event.type, p_request: { ...original, chargeId: fixture.chargeId, ...changed }, p_claim_token: randomUUID() });
        check(!conflict.error && conflict.data?.[0]?.result === 'needs_review', 'CORE_CONFLICT_PRESERVED');
      }
      check((await facts(fixture.projectId)).paid_amount === null, 'CORE_CONFLICT_NO_PAYMENT');
    });
    await test('two-known-charge-ids-still-conflict-on-the-same-event', async () => {
      const fixture = await setup(false), event = payment(fixture), input = normalizeNatoriPaymentEvent(event, { includeRefundMapping: true });
      const seeded = await claim(event, randomUUID()); check(!seeded.error, 'KNOWN_CHARGE_SEEDED');
      const conflict = await db.rpc('natori_stripe_event_claim_v1', { p_owner_id: owner, p_account: input.account, p_live: false,
        p_event_id: event.id, p_type: event.type, p_request: { ...input.request as Record<string, Json | undefined>, chargeId: 'ch_other' }, p_claim_token: randomUUID() });
      check(!conflict.error && conflict.data?.[0]?.result === 'needs_review', 'KNOWN_CHARGE_CONFLICT');
      const stored = await db.from('natori_stripe_event_inbox').select('request').eq('event_id', event.id).single();
      check(!stored.error && sameRequest(stored.data?.request, input.request as Record<string, Json | undefined>), 'KNOWN_CHARGE_ORIGINAL_FROZEN');
    });
    await test('unknown-original-remains-unresolved-and-visible', async () => {
      const fixture = await setup(), event = refund(fixture, { intentId: 'pi_unknown', chargeId: 'ch_unknown' }); await post(event);
      check((await summary(fixture.projectId)).confirmedAmount === 0 && (await ledger(fixture.projectId))[0].resolution === 'unmatched', 'UNMATCHED_EXCLUDED');
      const attention = await db.rpc('natori_payment_attention_v1', { p_owner_id: owner });
      check(Array.isArray(attention.data) && attention.data.some(item => item !== null && typeof item === 'object' && !Array.isArray(item) && item.reason === 'original_payment_unmatched'), 'UNMATCHED_VISIBLE');
    });
    await test('explicit-other-product-refunds-do-not-enter-natori-ledger', async () => {
      const fixture = await setup(); for (const kind of ['aura', 'card', 'gallery']) check((await post(refund(fixture, { kind }))).status === 200, 'OTHER_ACK');
      check((await ledger(fixture.projectId)).length === 0 && (await summary(fixture.projectId)).confirmedAmount === 0, 'OTHER_PRODUCT_UNTOUCHED');
    });
    await test('other-project-hint-cannot-refund-original-project', async () => {
      const fixture = await setup(), other = await setup(); await post(refund(fixture, { projectId: other.projectId }));
      check((await summary(fixture.projectId)).confirmedAmount === 0 && (await summary(other.projectId)).confirmedAmount === 0, 'NO_CROSS_PROJECT_REFUND');
      check((await ledger(other.projectId))[0]?.review_reason === 'refund_project_mismatch', 'CROSS_PROJECT_REVIEW');
    });
    await test('currency-invalid-amount-and-over-total-are-quarantined', async () => {
      const fixture = await setup(); await post(refund(fixture, { currency: 'usd' })); await post(refund(fixture, { amount: 13000 })); await post(refund(fixture, { amount: 1.5 }));
      await post(refund(fixture, { amount: 10000 })); await post(refund(fixture, { amount: 3000 }));
      check((await summary(fixture.projectId)).confirmedAmount === 10000 && (await summary(fixture.projectId)).reviewCount === 4, 'MISMATCH_EXCLUDED');
    });
    await test('optional-signed-identifiers-enrich-without-false-conflict', async () => {
      const fixture = await setup(), event = refund(fixture, { intentId: null, projectId: null, status: 'pending' }); await post(event);
      await post(refund(fixture, { id: (event.data.object as Stripe.Refund).id, status: 'succeeded' }));
      const row = (await ledger(fixture.projectId))[0]; check(row.resolution === 'resolved' && row.payment_intent_id === fixture.intentId && (await summary(fixture.projectId)).confirmedAmount === 3000, 'ENRICHED');
    });
    await test('contradictory-refund-identity-keeps-facts-and-requires-review', async () => {
      const fixture = await setup(), event = refund(fixture); await post(event); await post(refund(fixture, { id: (event.data.object as Stripe.Refund).id, amount: 4000 }));
      const row = (await ledger(fixture.projectId))[0]; check(row.amount === 3000 && row.confirmed_at && row.review_reason === 'refund_identity_conflict', 'ORIGINAL_FACTS_RETAINED');
      check((await summary(fixture.projectId)).confirmedAmount === 0, 'QUARANTINE_VISIBLE');
    });
    await test('charge-snapshot-deduplicates-refund-events-and-flags-incomplete-list', async () => {
      const fixture = await setup(), event = refund(fixture); await post(event);
      const charge = { ...event, id: 'evt_' + randomUUID(), type: 'charge.refunded', created: ++created, data: { object: { id: fixture.chargeId,
        payment_intent: fixture.intentId, metadata: { kind: 'natori_commission', projectId: fixture.projectId }, amount_refunded: 9000,
        refunds: { has_more: true, data: [event.data.object] } } } } as unknown as Stripe.Event;
      check((await post(charge)).status === 200 && (await ledger(fixture.projectId)).length === 1 && (await summary(fixture.projectId)).confirmedAmount === 3000, 'SNAPSHOT_DEDUP');
      const attention = await db.rpc('natori_payment_attention_v1', { p_owner_id: owner });
      check(Array.isArray(attention.data) && attention.data.some(item => item !== null && typeof item === 'object' && !Array.isArray(item) && item.reason === 'refund_snapshot_incomplete'), 'INCOMPLETE_VISIBLE');
    });
    await test('concurrent-partials-cannot-exceed-original-and-replay-is-once', async () => {
      const fixture = await setup(), a = refund(fixture, { amount: 7000 }), b = refund(fixture, { amount: 7000 });
      const responses = await Promise.all([post(a), post(b)]); check(responses.every(response => [200, 503].includes(response.status)), 'CONCURRENT_RESPONSE');
      await post(a); await post(b); check((await summary(fixture.projectId)).confirmedAmount === 7000 && (await ledger(fixture.projectId)).length === 2, 'NO_OVER_REFUND');
    });
    await test('stale-lease-owner-and-anonymous-cannot-complete-refund', async () => {
      const fixture = await setup(), event = refund(fixture), a = randomUUID(), b = randomUUID(); const first = await claim(event, a); check(first.data?.[0], 'FIRST_CLAIM');
      check(!(await db.from('natori_stripe_event_inbox').update({ lease_until: new Date(Date.now() - 1000).toISOString() }).eq('event_id', event.id)).error, 'EXPIRE_LEASE');
      const second = await claim(event, b); check(second.data?.[0], 'SECOND_CLAIM');
      check((await complete(event, a, first.data![0].generation)).data?.[0]?.result === 'stale', 'STALE_FENCED');
      check((await complete(event, b, second.data![0].generation, randomUUID())).data?.[0]?.result === 'stale', 'OWNER_FENCED');
      check((await ledger(fixture.projectId)).length === 0, 'NO_UNAUTHORIZED_EFFECT');
      const anon = createClient<Database>(origin, keys.anon, { auth: { persistSession: false } });
      check((await anon.rpc('natori_stripe_event_complete_v2', { p_owner_id: owner, p_account: 'platform', p_live: false, p_event_id: event.id, p_claim_token: b, p_generation: second.data![0].generation })).error, 'ANON_DENIED');
      check((await complete(event, b, second.data![0].generation)).data?.[0]?.result === 'completed', 'TRUE_OWNER_COMPLETES');
    });
    await test('commit-response-loss-replay-keeps-one-ledger-one-notice', async () => {
      const fixture = await setup(), event = refund(fixture); loseComplete = true; check((await post(event)).status === 503, 'RESPONSE_LOST');
      check((await ledger(fixture.projectId)).length === 1, 'COMMITTED'); check((await post(event)).status === 200, 'REPLAY_ACK');
      check((await ledger(fixture.projectId)).length === 1 && (await notices(fixture.projectId)).length === 1, 'REPLAY_ONCE');
    });
    await test('real-db-summary-results-csv-match-with-status-preserved', async () => {
      const fixture = await setup(); await post(refund(fixture, { amount: 3000 })); await post(refund(fixture, { amount: 2000, status: 'pending' }));
      check(!(await db.from('natori_projects').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', fixture.projectId)).error, 'COMPLETED_SETUP');
      const before = await facts(fixture.projectId), financial = await summary(fixture.projectId);
      const view: NatoriProject = { id: fixture.projectId, title: 'Synthetic', clientName: 'Synthetic', type: 'illustration', status: 'completed', amount: 12000,
        paidAmount: before.paid_amount ?? undefined, paidAt: before.paid_at ?? before.payment_confirmed_at ?? undefined,
        completedAt: before.completed_at ?? undefined, dueDate: null, nextAction: before.next_action, tasks: [],
        refunds: { available: true, originalMapped: financial.originalMapped, confirmedAmount: financial.confirmedAmount, pendingCount: financial.pendingCount, reviewCount: financial.reviewCount } };
      const aggregate = results.summarizeNatoriResults([view], new Date()), row = results.buildNatoriResultsCsv([view]).slice(1).split('\r\n')[1].split(',');
      check(Number(row[4]) === 12000 && Number(row[6]) === 3000 && Number(row[7]) === 9000 && aggregate.totalAmount === 12000 && aggregate.totalRefundedAmount === 3000 && aggregate.totalNetAmount === 9000, 'CSV_EQUALS_DB');
      check(JSON.stringify(before) === JSON.stringify(await facts(fixture.projectId)), 'READS_KEEP_STATUS');
    });
    await test('signature-mode-and-owner-private-read-boundaries', async () => {
      const fixture = await setup(), event = refund(fixture); check((await post(event, true)).status === 400, 'BAD_SIGNATURE'); check((await post({ ...event, livemode: true })).status === 503, 'BAD_MODE');
      const other = randomUUID(); check((await db.rpc('natori_refund_summaries_v1', { p_owner_id: other, p_project_ids: [fixture.projectId] })).data?.length === 0, 'OWNER_SUMMARY');
      check((await ledger(fixture.projectId)).length === 0, 'BAD_EVENT_NO_EFFECT');
    });
    await test('duplicate-checkout-conflicts-cannot-rewrite-original-mapping-or-refund-totals', async () => {
      const fixture = await setup(), other = await setup(); await post(refund(fixture));
      const before = await db.from('natori_payment_transactions').select('*').eq('stripe_session_id', fixture.sessionId).single(); check(before.data, 'ORIGINAL_TRANSACTION');
      const originalFacts = await facts(fixture.projectId);
      for (const changes of [{ currency: 'usd' }, { metadata: { kind: 'natori_commission', projectId: fixture.projectId, quoteId: other.quoteId } },
        { payment_intent: { id: 'pi_conflicting', latest_charge: fixture.chargeId } },
        { payment_intent: { id: fixture.intentId, latest_charge: 'ch_conflicting' } }]) {
        const base = payment(fixture);
        const event = { ...base, data: { object: { ...base.data.object, ...changes } } } as unknown as Stripe.Event;
        const response = await post(event); check(response.status === 200, 'CONFLICT_DURABLE_ACK');
        const inbox = await db.from('natori_stripe_event_inbox').select('status').eq('event_id', event.id).single();
        check(inbox.data?.status === 'needs_review', 'CONFLICT_REVIEW');
        const after = await db.from('natori_payment_transactions').select('*').eq('stripe_session_id', fixture.sessionId).single();
        check(JSON.stringify(before.data) === JSON.stringify(after.data), 'MAPPING_UNCHANGED');
        check((await summary(fixture.projectId)).confirmedAmount === 3000 && JSON.stringify(originalFacts) === JSON.stringify(await facts(fixture.projectId)), 'REFUND_AND_BUSINESS_UNCHANGED');
      }
    });
    await test('legacy-paid-original-with-unknown-scope-mode-retains-gross-and-unknown-net', async () => {
      const fixture = await setup();
      check(!(await db.from('natori_projects').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', fixture.projectId)).error, 'LEGACY_COMPLETED');
      check(!(await db.from('natori_payment_transactions').update({ stripe_account_scope: null, stripe_livemode: null, stripe_currency: null }).eq('stripe_session_id', fixture.sessionId)).error, 'LEGACY_UNKNOWN_SOURCE');
      const before = await facts(fixture.projectId), financial = await summary(fixture.projectId);
      check(financial.originalMapped === false && financial.confirmedAmount === null && financial.reviewCount === 1, 'LEGACY_NOT_ZERO');
      const attention = await db.rpc('natori_payment_attention_v1', { p_owner_id: owner });
      check(Array.isArray(attention.data) && attention.data.some(item => item !== null && typeof item === 'object' && !Array.isArray(item)
        && item.projectId === fixture.projectId && item.reason === 'refund_history_unverified'), 'LEGACY_REVIEW_VISIBLE');
      const view: NatoriProject = { id: fixture.projectId, title: 'Legacy synthetic', clientName: 'Synthetic', type: 'illustration', status: 'completed', amount: 12000,
        paidAmount: before.paid_amount ?? undefined, paidAt: before.paid_at ?? before.payment_confirmed_at ?? undefined,
        completedAt: before.completed_at ?? undefined, dueDate: null, nextAction: before.next_action, tasks: [],
        refunds: { available: true, originalMapped: financial.originalMapped, confirmedAmount: financial.confirmedAmount, pendingCount: financial.pendingCount, reviewCount: financial.reviewCount } };
      const aggregate = results.summarizeNatoriResults([view], new Date()), row = results.buildNatoriResultsCsv([view]).slice(1).split('\r\n')[1].split(',');
      check(row[4] === '12000' && row[6] === '' && row[7] === '' && aggregate.totalAmount === 12000
        && aggregate.totalRefundedAmount === null && aggregate.totalNetAmount === null, 'LEGACY_CSV_UNKNOWN');
      check(JSON.stringify(before) === JSON.stringify(await facts(fixture.projectId)) && (await notices(fixture.projectId)).length === 0, 'LEGACY_READ_ONLY_NO_MAIL');
    });
    await test('trusted-original-null-project-gross-keeps-refund-known-and-net-unknown', async () => {
      const unknown = await setup(), known = await setup();
      // Reproduce a schema-supported legacy projection while retaining the verified original transaction.
      for (const fixture of [unknown, known]) check(!(await db.from('natori_projects').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', fixture.projectId)).error, 'COMPLETED_FIXTURE');
      check(!(await db.from('natori_projects').update({ amount: null, paid_amount: null }).eq('id', unknown.projectId)).error, 'NULL_PROJECT_GROSS_SUPPORTED');
      const original = await db.from('natori_payment_transactions').select('*').eq('stripe_session_id', unknown.sessionId).single();
      check(original.data?.amount === 12000 && original.data.stripe_account_scope === 'platform' && original.data.stripe_currency === 'jpy', 'TRUSTED_ORIGINAL_RETAINED');
      check((await post(refund(unknown, { amount: 3000 }))).status === 200 && (await post(refund(known, { amount: 2000 }))).status === 200, 'REFUNDS_CONFIRMED');
      const before = await facts(unknown.projectId), projected = await summary(unknown.projectId);
      check(before.paid_amount === null && before.paid_at && projected.originalMapped === true && projected.confirmedAmount === 3000, 'ACTUAL_SUMMARY_REACHABLE');
      const views: NatoriProject[] = [];
      for (const fixture of [unknown, known]) {
        const row = await db.from('natori_projects').select('*').eq('id', fixture.projectId).single(); check(row.data && !row.error, 'OWNER_ROW');
        const projection = await summary(fixture.projectId);
        views.push(rowToProject({ ...row.data!, refunds: { available: true, originalMapped: projection.originalMapped,
          confirmedAmount: projection.confirmedAmount, pendingCount: projection.pendingCount, reviewCount: projection.reviewCount } }, [], []));
      }
      check(results.getNatoriResultFinancials(views[0]).gross === null && results.getNatoriResultFinancials(views[0]).net === null, 'REAL_MAPPER_UNKNOWN_GROSS');
      const aggregate = results.summarizeNatoriResults(views, new Date()), rows = results.buildNatoriResultsCsv(views).slice(1).trimEnd().split('\r\n').slice(1).map(line => line.split(','));
      check(aggregate.totalAmount === 12000 && aggregate.totalRefundedAmount === 5000 && aggregate.totalNetAmount === null
        && aggregate.thisYearNetAmount === null && aggregate.monthly.every(row => row.netAmount === null) && aggregate.byType.every(row => row.netAmount === null), 'AGGREGATE_NET_FAILS_CLOSED');
      check(rows.find(row => row[6] === '3000')?.[7] === '' && rows.find(row => row[6] === '3000')?.[8] === '確定返金あり（元の入金額は未確認）'
        && rows.find(row => row[6] === '2000')?.[7] === '10000', 'CSV_UNKNOWN_RETAINED');
      check(JSON.stringify(before) === JSON.stringify(await facts(unknown.projectId)), 'READS_PRESERVE_LEGACY_FACTS');
      const after = await db.from('natori_payment_transactions').select('*').eq('stripe_session_id', unknown.sessionId).single();
      check(JSON.stringify(original.data) === JSON.stringify(after.data), 'ORIGINAL_TRANSACTION_UNCHANGED');
    });
    await test('writer-off-read-on-real-rpc-retains-confirmed-financial-facts-without-effects', async () => {
      const fixture = await setup(); check((await post(refund(fixture, { amount: 12000 }))).status === 200, 'FULL_REFUND_ACK');
      check(!(await db.from('natori_projects').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', fixture.projectId)).error, 'COMPLETED_FIXTURE');
      const before = { facts: await facts(fixture.projectId), ledger: await ledger(fixture.projectId), notices: await notices(fixture.projectId) };
      const writer = process.env.NATORI_REFUND_LEDGER_ENABLED, reader = process.env.NATORI_REFUND_LEDGER_READ_ENABLED;
      try {
        process.env.NATORI_REFUND_LEDGER_ENABLED = '0'; process.env.NATORI_REFUND_LEDGER_READ_ENABLED = '1';
        const calls = refundSummaryCalls, projections = await loadNatoriRefundSummaries(owner, [fixture.projectId]);
        check(refundSummaryCalls === calls + 1 && projections?.get(fixture.projectId)?.confirmedAmount === 12000, 'READ_ONLY_REAL_RPC');
        const row = await db.from('natori_projects').select('*').eq('id', fixture.projectId).single(); check(row.data && !row.error, 'OWNER_ROW');
        const view = rowToProject({ ...row.data!, refunds: projections?.get(fixture.projectId) }, [], []);
        const financial = results.getNatoriResultFinancials(view), csv = results.buildNatoriResultsCsv([view]).slice(1).split('\r\n')[1].split(',');
        check(financial.state === 'full' && financial.gross === 12000 && financial.refunded === 12000 && financial.net === 0
          && csv[6] === '12000' && csv[7] === '0', 'READ_ONLY_FINANCIALS_RETAINED');
        process.env.NATORI_REFUND_LEDGER_READ_ENABLED = '0'; const beforeOff = refundSummaryCalls;
        check(await loadNatoriRefundSummaries(owner, [fixture.projectId]) === undefined && refundSummaryCalls === beforeOff, 'BOTH_OFF_NO_LEDGER_READ');
        check(JSON.stringify(before) === JSON.stringify({ facts: await facts(fixture.projectId), ledger: await ledger(fixture.projectId), notices: await notices(fixture.projectId) }), 'READ_ONLY_NO_EFFECT');
      } finally {
        if (writer === undefined) delete process.env.NATORI_REFUND_LEDGER_ENABLED; else process.env.NATORI_REFUND_LEDGER_ENABLED = writer;
        if (reader === undefined) delete process.env.NATORI_REFUND_LEDGER_READ_ENABLED; else process.env.NATORI_REFUND_LEDGER_READ_ENABLED = reader;
      }
    });
    writeFileSync('/results/phase2d-integration.json', JSON.stringify({ tests, passed: tests.filter(test => test.status === 'passed').length,
      failed: tests.filter(test => test.status === 'failed').length, skipped: 0, provider: 'synthetic Stripe SDK-signed payloads only; actual Stripe test-mode delivery pending', blockedDestinations: blockCount }, null, 2));
    check(tests.length === 37 && tests.every(test => test.status === 'passed'), 'PHASE_2D_REQUIRED_TESTS_FAILED');
    console.log('PHASE 2D 37 passed / 0 failed / 0 skipped; actual Stripe pending');
  } finally { globalThis.fetch = direct; }
}
main().catch(() => { console.error('Phase 2D integration failed; raw payloads and credentials withheld'); process.exitCode = 1; });
