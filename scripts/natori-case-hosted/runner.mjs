import { z } from 'zod';
import { approvePlan, HostedAcceptanceError, planDigest, requireCheck, validateDeploymentEvidence, validatePlan } from './config.mjs';
import { caseNoMailBudgetSchema } from '../../src/features/natori/lib/caseNoMailBudget.ts';

const sameSet = (a, b) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
const runSchema = z.strictObject({
  id: z.uuid(), owner_id: z.uuid(), project_ref: z.string(), origin: z.string(),
  provider_scope: z.string(), stripe_account: z.string(), starts_at: z.string(), ends_at: z.string(), enabled: z.boolean(),
  allowed_to: z.array(z.string()), human_to: z.array(z.string()), mail_limit: z.number().int(), human_limit: z.number().int(),
  used: z.number().int().nonnegative(), human_used: z.number().int().nonnegative(),
});
const fields = Object.keys(runSchema.shape).join(',');
export function controlUrls(plan) {
  return [
    `${plan.target.url}/rest/v1/natori_case_acceptance_runs?${new URLSearchParams({ select: fields, id: `eq.${plan.target.run}` })}`,
    `${plan.target.url}/rest/v1/natori_case_acceptance_projects?${new URLSearchParams({ select: 'project_id', run_id: `eq.${plan.target.run}` })}`,
    `${plan.target.url}/rest/v1/natori_projects?${new URLSearchParams({ select: 'id,user_id,deleted_at', id: `in.(${[...plan.fixtures.projects, plan.fixtures.foreignProject].join(',')})` })}`,
  ];
}
export function validateRun(plan, raw, members, owners, now) {
  const rows = z.array(runSchema).length(1).safeParse(raw);
  requireCheck(rows.success, 'run_unconfirmed');
  const r = rows.data[0], t = plan.target;
  requireCheck(r.id === t.run && r.owner_id === plan.owner && r.project_ref === t.ref && r.origin === t.origin
    && r.provider_scope === plan.mail.scope && r.stripe_account === plan.stripe.account, 'run_scope_mismatch');
  requireCheck(r.enabled && Date.parse(r.starts_at) === Date.parse(t.startsAt) && Date.parse(r.ends_at) === Date.parse(t.endsAt)
    && Date.parse(r.starts_at) <= now && now < Date.parse(r.ends_at), 'run_inactive');
  if (plan.purpose === 'hosted-no-mail-read-only') {
    requireCheck(caseNoMailBudgetSchema.safeParse(r).success, 'mail_contract_mismatch');
  } else {
    requireCheck(r.mail_limit === 12 && r.human_limit === 12 && r.used <= 12 && r.human_used <= r.used
      && sameSet(r.allowed_to, plan.mail.allowedTo) && sameSet(r.human_to, plan.mail.allowedTo), 'mail_contract_mismatch');
  }
  const projects = z.array(z.strictObject({ project_id: z.uuid() })).safeParse(members);
  requireCheck(projects.success && sameSet(projects.data.map(x => x.project_id), plan.fixtures.projects), 'membership_mismatch');
  const ownership = z.array(z.strictObject({ id: z.uuid(), user_id: z.uuid(), deleted_at: z.null() })).safeParse(owners);
  requireCheck(ownership.success && sameSet(ownership.data.map(x => x.id), [...plan.fixtures.projects, plan.fixtures.foreignProject])
    && ownership.data.every(x => x.id === plan.fixtures.foreignProject ? x.user_id !== plan.owner : x.user_id === plan.owner), 'ownership_mismatch');
  return { used: r.used, humanUsed: r.human_used };
}
async function json(response) {
  requireCheck(response.status === 200 && !response.redirected, 'control_read_failed');
  // Do not retain a raw body (or any provider error) in a result or exception.
  const reader = response.body?.getReader();
  requireCheck(reader, 'control_read_failed');
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      requireCheck(size <= 65536, 'control_response_too_large'); chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof HostedAcceptanceError) throw error;
    throw new HostedAcceptanceError('control_read_failed');
  } finally { reader.releaseLock(); }
}
export async function readControl(plan, key, transport, now) {
  // There is no caller-supplied URL, SQL, POST, redirect following, or retry.
  const result = [];
  for (const url of controlUrls(plan)) {
    validatePlan(plan, now());
    try {
      result.push(await json(await transport(url, {
        method: 'GET', headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      })));
    } catch (error) {
      if (error instanceof HostedAcceptanceError) throw error;
      throw new HostedAcceptanceError('control_read_failed');
    }
  }
  return validateRun(plan, result[0], result[1], result[2], now());
}

/** All I/O is injected. This module never reads credentials or starts a browser. */
export async function runHostedReadOnly({ input, approvedDigest, deploymentEvidence, credentials, transport, openBrowser, now = Date.now }) {
  const plan = validatePlan(input, now()); approvePlan(plan, approvedDigest);
  const deployment = validateDeploymentEvidence(plan, deploymentEvidence, now());
  requireCheck(typeof credentials?.anon === 'string' && credentials.anon.length > 0
    && typeof credentials.service === 'string' && credentials.service.length > 0
    && credentials.anon !== credentials.service
    && ['staff', 'outsider'].every(k => typeof credentials[k] === 'string' && credentials[k].length >= 12), 'credentials_required');
  const before = await readControl(plan, credentials.service, transport, now);
  const checks = [plan.purpose === 'hosted-no-mail-read-only'
    ? 'approved target/run/provider scope, empty recipients, zero mail attempts and membership matched'
    : 'approved target/run/provider scope/recipients/12-attempt contract and membership matched'];
  let browser;
  try {
    browser = await openBrowser({ plan, anon: credentials.anon, now });
    await browser.unauthenticated(); checks.push('unauthenticated API denied');
    for (const role of ['outsider', 'staff']) {
      validatePlan(plan, now());
      await browser.signIn(role, plan.fixtures[role], credentials[role]);
      if (role === 'outsider') {
        await browser.denied(); checks.push('nonstaff API denied');
      } else {
        await browser.refresh(); await browser.read(); await browser.views();
        checks.push('synthetic staff Cookie, refresh, owner isolation, workspace reads and PC/mobile history verified');
      }
      await browser.signOut(); await browser.unauthenticated();
    }
    const after = await readControl(plan, credentials.service, transport, now);
    requireCheck(after.used === before.used && after.humanUsed === before.humanUsed, 'mail_spend_changed');
    const network = browser.evidence();
    requireCheck(network.denied.length === 0, 'unexpected_browser_request');
    checks.push('mail spend unchanged; logout denied; browser allowed only scoped reads and Auth operations');
    return { success: true, digest: planDigest(plan), run: plan.target.run, sourceCommit: plan.sourceCommit, deployment, checks, network,
      mailVerification: 'not performed by read-only preflight',
      limits: ['Deployment receipt is supplied by the trusted parent control-plane read, not a cryptographic attestation',
        'Stripe account here is compared with the DB contract; no direct Stripe/key verification',
        'no business mutations, mail/provider/Storage acceptance, Google OAuth or physical iPhone verification'] };
  } catch (error) {
    if (error instanceof HostedAcceptanceError) throw error;
    throw new HostedAcceptanceError('hosted_read_unconfirmed');
  } finally {
    if (browser) {
      try { await browser.close(); }
      catch { throw new HostedAcceptanceError('browser_cleanup_unconfirmed'); }
    }
  }
}
