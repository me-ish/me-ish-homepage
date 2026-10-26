// Dependency-free, dedicated-package boundary. No IO, credentials or authority grant.
export const dedicated = Object.freeze({
 project:'prj_naQn1RrcnOGk6PcNCZsWOTuFuENz',ref:'vflqlsmblwiwrukjwwec',
 url:'https://vflqlsmblwiwrukjwwec.supabase.co',origin:'https://natori-case-readonly-20261024.vercel.app',
 owner:'16018e8a-f04a-4dd3-a95c-a0a0354af590',account:'acct_1RFvWFR8VcxhZwpx',
});
export const integrityFlags=['NATORI_PAYMENT_LINK_INTEGRITY_ENABLED','NATORI_ACCEPTANCE_OUTBOX_ENABLED',
 'NATORI_QUOTE_INTEGRITY_ENABLED','NATORI_PAYMENT_INTEGRITY_ENABLED','NATORI_DELIVERY_INTEGRITY_ENABLED'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertOperationPlan(plan) {
 const t=plan?.target,start=Date.parse(t?.startsAt),end=Date.parse(t?.endsAt);
 if(plan?.purpose!=='hosted-no-mail-read-only'||plan.owner!==dedicated.owner||plan.stripe?.account!==dedicated.account
  ||plan.stripe?.mode!=='test'||plan.mail?.maxAttempts!==0||plan.mail?.allowedTo?.length!==0
  ||t?.profile!=='hosted'||!['project','ref','url','origin'].every(k=>t[k]===dedicated[k])
  ||!Array.isArray(plan.fixtures?.projects)||plan.fixtures.projects.length<1||plan.fixtures.projects.length>6
  ||!uuid.test(t.run)||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)throw Error('operation_plan_invalid');
 return t;
}
export function assertOperationPlatform(env,plan,now=Date.now(),observe=false) {
 const t=assertOperationPlan(plan),marker=JSON.stringify(t);
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_TARGET_ENV!=='preview'||env.VERCEL_PROJECT_ID!==dedicated.project
  ||env.SUPABASE_URL!==t.url||env.NEXT_PUBLIC_SUPABASE_URL!==t.url||env.NEXT_PUBLIC_SITE_URL!==t.origin
  ||env.NATORI_CASE_ACCEPTANCE_TARGET!==marker||env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET!==marker
  ||env.NATORI_OWNER_USER_ID!==plan.owner||env.NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT!==dedicated.account
  ||env.NATORI_CASE_ACCEPTANCE_MAIL_SCOPE!==plan.mail.scope||env.NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT!==t.endsAt
  ||env.NATORI_CASE_ACCEPTANCE_NO_MAIL!=='1'||env.NATORI_NOTIFICATION_SENDING_ENABLED!=='0'
  ||env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED!=='1'||env.NATORI_CASE_PAYMENT_WORKSPACE_ENABLED!=='1'
  ||!integrityFlags.every(k=>env[k]==='1')||env.NATORI_STRIPE_MODE!=='test'
  ||env.RESEND_API_KEY||env.NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET
  ||env.NATORI_CASE_PRODUCTION_MAIL_CONNECTION||env.NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS
  ||env.NATORI_CASE_RELEASE_ENABLED&&env.NATORI_CASE_RELEASE_ENABLED!=='0'
  ||env.NATORI_DASHBOARD_KEY||env.ADMIN_EMAILS||env.NATORI_OWNER_EMAILS
  ||!Number.isFinite(now)||now<Date.parse(t.startsAt)||!observe&&now>=Date.parse(t.endsAt))throw Error('operation_platform_denied');
 const staff=(env.NATORI_STAFF_EMAILS??'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).sort();
 if(JSON.stringify(staff)!==JSON.stringify([plan.fixtures.staff.email,'info@me-ish.art'].sort()))throw Error('operation_staff_denied');
 return {environment:'preview',project:t.project,databaseRef:t.ref};
}
export function operationDecision(env,plan,{origin,pathname,method,now=Date.now()}) {
 try {assertOperationPlatform(env,plan,now,true);}catch{return 503;}
 if(origin!==plan.target.origin)return 503;
 if(pathname.startsWith('/api/cron/')||pathname==='/api/webhook/resend')return 404;
 // Expired human/staff access cannot be revived by a retained session. Signed
 // late facts still reach the ordinary signature/capability and owner guards.
 const fact=method==='POST'&&['/api/webhook/stripe','/api/natori/quote/accept','/api/natori/delivery/accept'].includes(pathname);
 if(now>=Date.parse(plan.target.endsAt)&&!fact)return 503;
 return null; // Normal middleware, Auth, CSRF, run/owner checks and L7 still apply.
}
