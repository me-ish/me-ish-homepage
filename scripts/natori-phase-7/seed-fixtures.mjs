import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire('/app/package.json');
const { createClient } = require('@supabase/supabase-js');
const check = (value, code) => { if (!value) throw new Error(code); };

export async function seedPhase7(origin, keys) {
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), 'DESTINATION_REJECTED');
  const db = createClient(origin, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { seedContent, requestData, quoteTerms, agreedTerms, items } = require('/phase7/fixtures.cjs');
  const email = 'phase7-owner@phase0b-browser.invalid', password = randomBytes(32).toString('hex');
  const auth = await db.auth.admin.createUser({ email, password, email_confirm: true });
  check(!auth.error && auth.data.user, 'AUTH_FIXTURE'); const owner = auth.data.user.id;
  check(!(await db.from('natori_portfolio_content').upsert({ id: 'main', content: seedContent })).error, 'CONTENT_FIXTURE');
  const now = new Date().toISOString(), expires = new Date(Date.now() + 10 * 86400000).toISOString();
  const deadline = new Date(Date.now() + 5 * 86400000).toISOString();
  const estimateId = randomUUID(), quoteProjectId = randomUUID(), managementId = randomUUID(), editableEstimateId = randomUUID();
  const quoteToken = randomBytes(24).toString('base64url'), linkId = 'plink_phase7' + randomUUID().replaceAll('-', '');
  const base = { user_id: owner, client_name: 'Synthetic Phase 7 client', client_email: 'client@phase7.invalid', type: 'illustration', delivery_plan: 'normal', request_data: requestData };
  const projects = [
    { ...base, id: editableEstimateId, title: 'Phase 7 editable estimate', status: 'estimating', next_action: 'Synthetic editable estimate review' },
    { ...base, id: estimateId, title: 'Phase 7 historical estimate', status: 'inquiry', next_action: 'Synthetic historical quote review' },
    { ...base, id: quoteProjectId, title: 'Phase 7 full saved quote', status: 'inquiry', next_action: 'Synthetic awaiting payment', payment_link_id: linkId,
      payment_link_url: 'https://buy.stripe.com/test_phase7synthetic', payment_link_status: 'ready' },
    { ...base, id: managementId, title: 'Phase 7 active production', status: 'rough', amount: 12000, paid_amount: 12000,
      paid_at: now, payment_confirmed_at: now, due_date: '2026-11-15', next_action: 'Synthetic rough: preserve original conditions' },
  ];
  check(!(await db.from('natori_projects').insert(projects)).error, 'PROJECT_FIXTURE');
  check(!(await db.from('natori_estimate_drafts').insert({ project_id: estimateId, user_id: owner, revision: 1, agreed_terms: agreedTerms,
    items, mail_draft: { subject: 'Synthetic historical quote', body: 'Synthetic saved mail; not sent', templateBody: 'Synthetic saved mail; not sent' } })).error, 'DRAFT_FIXTURE');
  check(!(await db.from('natori_estimate_drafts').insert({ project_id: editableEstimateId, user_id: owner, revision: 1,
    agreed_terms: agreedTerms, items, mail_draft: null })).error, 'DRAFT_FIXTURE');
  for (const [projectId, token] of [[estimateId, randomBytes(24).toString('base64url')], [quoteProjectId, quoteToken]]) {
    const quoteId = randomUUID();
    check(!(await db.from('natori_quotes').insert({ id: quoteId, project_id: projectId, user_id: owner, version: 1,
      title: projectId === estimateId ? 'Phase 7 historical estimate' : 'Phase 7 full saved quote', client_name: base.client_name,
      to_email: base.client_email, amount: 12000, subject: 'Synthetic quote', body_snapshot: 'Synthetic original agreement retained',
      token_hash: createHash('sha256').update(token).digest('hex'), expires_at: expires, accepted_at: now,
      quote_terms: quoteTerms, pricing_snapshot: { items } })).error, 'QUOTE_FIXTURE');
    check(!(await db.from('natori_projects').update({ status: 'awaiting_payment', active_quote_id: quoteId, payment_quote_id: quoteId,
      quote_accepted_at: now, quote_accepted_amount: 12000, quoted_amount: 12000 }).eq('id', projectId).eq('user_id', owner)).error, 'ACCEPTED_FIXTURE');
    if (projectId === quoteProjectId) {
      check(!(await db.from('natori_payment_link_attempts').insert({ project_id: projectId, owner_id: owner, quote_id: quoteId,
        generation: 1, amount: 12000, livemode: false, provider_account_id: 'acct_phase7fixture', state: 'active',
        price_id: 'price_phase7fixture', link_id: linkId, link_url: 'https://buy.stripe.com/test_phase7synthetic', deadline, deadline_revision: 2 })).error, 'LINK_FIXTURE');
    }
  }
  check(!(await db.from('natori_project_tasks').insert([{ project_id: managementId, task_key: 'phase7-rough-task', label: 'Synthetic rough task',
    stage: 'rough', done: false, estimated_hours: 2, sort_order: 0 }])).error, 'TASK_FIXTURE');
  return { owner, email, password, estimateId, quoteProjectId, managementId, editableEstimateId, quoteToken, deadline };
}
