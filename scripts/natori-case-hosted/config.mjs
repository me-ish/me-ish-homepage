import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { parseCaseAcceptanceTarget } from '../../src/features/natori/lib/caseAcceptanceTarget.ts';

export class HostedAcceptanceError extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function requireCheck(condition, code) {
  if (!condition) throw new HostedAcceptanceError(code);
}
const unique = values => new Set(values).size === values.length;
const email = z.email().refine(v => v === v.trim().toLowerCase());
const actor = z.strictObject({ id: z.uuid(), email: email.refine(v => v.endsWith('@example.invalid')) });
const schema = z.strictObject({
  version: z.literal(1), purpose: z.enum(['hosted-password-read-only','hosted-no-mail-read-only']),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
  target: z.strictObject({
    profile: z.literal('hosted'), ref: z.string(), project: z.string(), url: z.string(),
    origin: z.string(), run: z.uuid(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
  }),
  owner: z.uuid(), stripe: z.strictObject({ account: z.string().regex(/^acct_[A-Za-z0-9]+$/), mode: z.literal('test') }),
  mail: z.union([
    z.strictObject({ scope: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), allowedTo: z.array(email).min(1).max(2), maxAttempts: z.literal(12) }),
    z.strictObject({ scope: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), allowedTo: z.array(email).length(0), maxAttempts: z.literal(0) }),
  ]),
  fixtures: z.strictObject({
    staff: actor, outsider: actor, projects: z.array(z.uuid()).min(1).max(10), foreignProject: z.uuid(),
  }),
});
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}
export function validatePlan(input, now = Date.now()) {
  const parsed = schema.safeParse(input);
  requireCheck(parsed.success, 'plan_invalid');
  const plan = parsed.data;
  requireCheck((plan.purpose === 'hosted-no-mail-read-only') === (plan.mail.maxAttempts === 0), 'mail_contract_mismatch');
  try { parseCaseAcceptanceTarget(JSON.stringify(plan.target), plan.target.url, now); }
  catch { throw new HostedAcceptanceError('target_invalid'); }
  requireCheck(plan.target.url === new URL(plan.target.url).origin, 'target_invalid');
  // A separate approved Vercel Preview is the only hosted runner target. A
  // custom/arbitrary host is not opened merely because it appears in a URL.
  requireCheck(/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.vercel\.app$/.test(plan.target.origin), 'host_invalid');
  requireCheck(unique(plan.mail.allowedTo), 'recipients_invalid');
  const f = plan.fixtures;
  requireCheck(f.staff.id !== f.outsider.id && f.staff.email !== f.outsider.email, 'actors_invalid');
  requireCheck(unique(f.projects) && !f.projects.includes(f.foreignProject), 'projects_invalid');
  return plan;
}
export function planDigest(plan) {
  return createHash('sha256').update(JSON.stringify(stable(plan))).digest('hex');
}
export function approvePlan(plan, digest) {
  requireCheck(typeof digest === 'string' && /^[a-f0-9]{64}$/.test(digest), 'approval_required');
  requireCheck(timingSafeEqual(Buffer.from(planDigest(plan)), Buffer.from(digest)), 'approval_mismatch');
}
export function validateDeploymentEvidence(plan, input, now) {
  // A normalized, nonsecret receipt from the parent's authorized control-plane
  // read. The runner must not infer project/commit from a hostname or page.
  const parsed = z.strictObject({
    version: z.literal(1), origin: z.string(), project: z.string(), sourceCommit: z.string(),
    environment: z.literal('preview'), status: z.literal('READY'), observedAt: z.iso.datetime(),
    mailMode: z.literal('disabled').optional(), notificationSendingEnabled: z.literal(false).optional(), resendKeyConfigured: z.literal(false).optional(),
  }).safeParse(input);
  requireCheck(parsed.success, 'deployment_evidence_required');
  const e = parsed.data, observed = Date.parse(e.observedAt);
  if (plan.purpose === 'hosted-no-mail-read-only') requireCheck(e.mailMode === 'disabled'
    && e.notificationSendingEnabled === false && e.resendKeyConfigured === false, 'no_mail_deployment_unconfirmed');
  requireCheck(e.origin === plan.target.origin && e.project === plan.target.project && e.sourceCommit === plan.sourceCommit,
    'deployment_evidence_mismatch');
  requireCheck(observed <= now && now - observed <= 5 * 60000, 'deployment_evidence_stale');
  return e;
}
export function describePlan(plan) {
  return {
    purpose: plan.purpose, digest: planDigest(plan), sourceCommit: plan.sourceCommit,
    mailVerification: plan.purpose === 'hosted-no-mail-read-only' ? 'not performed; all mail disabled' : 'not performed by read-only preflight',
    target: plan.target, stripe: plan.stripe, mail: plan.mail,
    operations: ['read run configuration/membership', 'synthetic password login/refresh/logout', 'read workspace/payment/reconciliation', 'desktop/mobile/history/reload'],
    excluded: ['create users or fixtures', 'business writes', 'mail/payment/provider operations', 'Google OAuth', 'iPhone hardware'],
  };
}
