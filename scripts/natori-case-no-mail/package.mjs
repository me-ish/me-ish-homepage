// Local-only adaptation of the reviewed source archive pipeline. No upload/deploy.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildPackage,readonlyMiddleware,readonlyLoginPage,readonlyGoogleCallback} from '../natori-case-initial-preview/package.mjs';
import {plan as previous} from '../natori-case-initial-preview/plan.mjs';
import {validatePlan} from '../natori-case-hosted/config.mjs';
import {assertOperationPlan} from './hosted-gate.mjs';
import {privateLaunchers} from '../natori-case-initial-preview/launchers.mjs';
const root=resolve(import.meta.dirname,'../..');
export function operationMiddleware(source,target) {
 const full=readonlyMiddleware(source,'google');
 const start=full.indexOf('  const initialStatus ='),end=full.indexOf('  // These paths were excluded');
 if(start<0||end<start)throw Error('operation_middleware_source_changed');
 return full.replace("import { initialReadonlyDecision } from './lib/initialReadonlyPreviewGuard';", "import { operationDecision } from './lib/operationHostedGate.mjs';\nimport { plan as operationPlan } from './lib/operationPlan.mjs';")
  .slice(0).replace(full.slice(start,end),`  const operationEnv={VERCEL_ENV:process.env.VERCEL_ENV,VERCEL_TARGET_ENV:process.env.VERCEL_TARGET_ENV,VERCEL_PROJECT_ID:process.env.VERCEL_PROJECT_ID,SUPABASE_URL:process.env.SUPABASE_URL,NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SITE_URL:process.env.NEXT_PUBLIC_SITE_URL,NATORI_CASE_ACCEPTANCE_TARGET:process.env.NATORI_CASE_ACCEPTANCE_TARGET,NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET:process.env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET,NATORI_OWNER_USER_ID:process.env.NATORI_OWNER_USER_ID,NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT:process.env.NATORI_CASE_ACCEPTANCE_STRIPE_ACCOUNT,NATORI_CASE_ACCEPTANCE_MAIL_SCOPE:process.env.NATORI_CASE_ACCEPTANCE_MAIL_SCOPE,NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT:process.env.NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT,NATORI_CASE_ACCEPTANCE_NO_MAIL:process.env.NATORI_CASE_ACCEPTANCE_NO_MAIL,NATORI_NOTIFICATION_SENDING_ENABLED:process.env.NATORI_NOTIFICATION_SENDING_ENABLED,NATORI_CASE_DASHBOARD_PREVIEW_ENABLED:process.env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED,NATORI_CASE_PAYMENT_WORKSPACE_ENABLED:process.env.NATORI_CASE_PAYMENT_WORKSPACE_ENABLED,NATORI_PAYMENT_LINK_INTEGRITY_ENABLED:process.env.NATORI_PAYMENT_LINK_INTEGRITY_ENABLED,NATORI_ACCEPTANCE_OUTBOX_ENABLED:process.env.NATORI_ACCEPTANCE_OUTBOX_ENABLED,NATORI_QUOTE_INTEGRITY_ENABLED:process.env.NATORI_QUOTE_INTEGRITY_ENABLED,NATORI_PAYMENT_INTEGRITY_ENABLED:process.env.NATORI_PAYMENT_INTEGRITY_ENABLED,NATORI_DELIVERY_INTEGRITY_ENABLED:process.env.NATORI_DELIVERY_INTEGRITY_ENABLED,NATORI_STRIPE_MODE:process.env.NATORI_STRIPE_MODE,RESEND_API_KEY:process.env.RESEND_API_KEY,NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET:process.env.NATORI_CASE_ACCEPTANCE_RESEND_WEBHOOK_SECRET,NATORI_CASE_PRODUCTION_MAIL_CONNECTION:process.env.NATORI_CASE_PRODUCTION_MAIL_CONNECTION,NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS:process.env.NATORI_CASE_PRODUCTION_MAIL_WEBHOOK_SECRETS,NATORI_CASE_RELEASE_ENABLED:process.env.NATORI_CASE_RELEASE_ENABLED,NATORI_DASHBOARD_KEY:process.env.NATORI_DASHBOARD_KEY,ADMIN_EMAILS:process.env.ADMIN_EMAILS,NATORI_OWNER_EMAILS:process.env.NATORI_OWNER_EMAILS,NATORI_STAFF_EMAILS:process.env.NATORI_STAFF_EMAILS};
  const initialStatus=operationDecision(operationEnv,operationPlan,{origin:request.nextUrl.origin,pathname:request.nextUrl.pathname,method:request.method});
  if(initialStatus)return NextResponse.json({error:'no_mail_operation_blocked'},{status:initialStatus,headers:{'Cache-Control':'private, no-store'}});
`);
}
export function buildOperationPackage(output,input,now=Date.now()) {
 const plan=validatePlan(input,now);assertOperationPlan(plan);
 if(plan.sourceCommit!==execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim())throw Error('operation_source_mismatch');
 buildPackage(output,{authentication:'google'});const out=resolve(output);
 const planModule='export const plan='+JSON.stringify(plan)+';\n';
 const gate=readFileSync(root+'/scripts/natori-case-no-mail/hosted-gate.mjs','utf8');
 const platform=`import {plan} from './operation-plan.mjs';import {assertOperationPlatform} from './hosted-gate.mjs';import {pathToFileURL} from 'node:url';export function assertInitialPreviewPlatform(env){return assertOperationPlatform(env,plan);}if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(assertInitialPreviewPlatform(process.env)));}catch{console.error('operation_platform_denied');process.exitCode=1;}}`;
 const record=JSON.parse(readFileSync(out+'/archive-members.json','utf8'));
 const o=record.overlays;
 o['src/middleware.ts']=operationMiddleware(readFileSync(root+'/src/middleware.ts','utf8'),plan.target);
 o['src/lib/operationHostedGate.mjs']=gate;o['src/lib/operationPlan.mjs']=planModule;
 o['src/app/admin-login/page.tsx']=readonlyLoginPage('google').replace(JSON.stringify(previous.target),JSON.stringify(plan.target));
 o['src/app/admin-login/AdminLoginClient.tsx']=readFileSync(root+'/scripts/natori-case-initial-preview/google-login.client.tsx','utf8').replace('検証案件の閲覧のみで、更新・メール送信・決済は停止しています。','架空案件の操作・添付・テスト決済を確認します。実メール送信と実際の課金決済は停止しています。');
 o['src/app/auth/callback/route.ts']=readonlyGoogleCallback(readFileSync(root+'/src/app/auth/callback/route.ts','utf8'));
 o['scripts/natori-case-initial-preview/platform-gate.mjs']=platform;
 o['scripts/natori-case-initial-preview/hosted-gate.mjs']=gate;
 o['scripts/natori-case-initial-preview/operation-plan.mjs']=planModule;
 o['scripts/natori-case-initial-preview/google-deadline.mjs']=`export function assertGoogleReadAccess(env,now=Date.now()){if(env.NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT!==${JSON.stringify(plan.target.endsAt)}||now<${Date.parse(plan.target.startsAt)}||now>=${Date.parse(plan.target.endsAt)})throw Error('operation_access_expired');}`;
 for(const name of ['hosted-gate.mjs','hosted-preflight.mjs'])o['scripts/natori-case-no-mail/'+name]=readFileSync(root+'/scripts/natori-case-no-mail/'+name,'utf8');
 o['scripts/natori-case-no-mail/operation-plan.mjs']=planModule;
 for(const name of ['runner.mjs','config.mjs'])o['scripts/natori-case-hosted/'+name]=readFileSync(root+'/scripts/natori-case-hosted/'+name,'utf8');
 // Rebuild from the same allowlisted members and exact overlays, without extracting.
 writeFileSync(out+'/archive-members.json',JSON.stringify(record));
 execFileSync('python3',['-c',`import json,tarfile,io,pathlib
p=pathlib.Path(${JSON.stringify(out)});r=json.loads((p/'archive-members.json').read_text())
with tarfile.open(p/'application-source.tar.gz','w:gz',compresslevel=9) as t:
 for name in sorted(set(r['members'])|set(r['overlays'])):
  if name in r['overlays']:
   b=r['overlays'][name].encode();m=tarfile.TarInfo(name);m.size=len(b);m.mode=0o644;t.addfile(m,io.BytesIO(b))
  else:t.add(pathlib.Path(r['root'])/name,arcname=name,recursive=False)
`]);
 const archive=readFileSync(out+'/application-source.tar.gz'),sha256=createHash('sha256').update(archive).digest('hex'),parts=[];
 for(let start=0,i=0;start<archive.length;start+=2097152,i++){const data=archive.subarray(start,start+2097152),file=`application-source.part-${String(i).padStart(3,'0')}`;writeFileSync(out+'/'+file,data);parts.push({file,size:data.length,sha:createHash('sha1').update(data).digest('hex')});}
 writeFileSync(out+'/preview-platform-gate.mjs',platform);writeFileSync(out+'/hosted-gate.mjs',gate);writeFileSync(out+'/operation-plan.mjs',planModule);
 const launchers=privateLaunchers(sha256,parts.length,'google');launchers['preview-build.cjs']=launchers['preview-build.cjs'].replace('scripts/natori-case-initial-preview/google-preflight.mjs','scripts/natori-case-no-mail/hosted-preflight.mjs');
 for(const [name,data]of Object.entries(launchers))writeFileSync(out+'/'+name,data);
 const inline=file=>({file,data:readFileSync(out+'/'+file).toString('base64'),encoding:'base64'});
 const request=JSON.parse(readFileSync(out+'/deployment-request.json','utf8'));
 request.files=[...parts,...['vercel.json','preview-platform-gate.mjs','hosted-gate.mjs','operation-plan.mjs',...Object.keys(launchers)].map(inline),{file:'package.json',data:readFileSync(root+'/package.json').toString('base64'),encoding:'base64'}];
 request.projectSettings.installCommand='node preview-install.cjs';request.projectSettings.buildCommand='node preview-build.cjs';request.meta={sourceCommit:plan.sourceCommit,purpose:'dedicated-no-mail-operation-preview',sourceArchiveSHA256:sha256};
 writeFileSync(out+'/deployment-request.json',JSON.stringify(request));
 const manifest={sourceCommit:plan.sourceCommit,archiveSHA256:sha256,archiveBytes:archive.length,parts:parts.length,configuredCrons:0,previewOnly:true,expiresAt:plan.target.endsAt,mailAttempts:0,setupWrites:0,uploaded:false,deployed:false,normalMiddlewareAndAuth:'retained after dedicated platform/mail/expiry guard; fixed Google callback',lateFacts:'ordinary signature/capability guards remain; no result inference'};
 writeFileSync(out+'/manifest.json',JSON.stringify(manifest,null,2));return manifest;
}
