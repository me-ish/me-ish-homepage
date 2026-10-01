import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output?.includes('/natori-phase-t.')||!output.endsWith('/browser-app'))throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums=JSON.parse(readFileSync(resolve(output,'source-checksums.json'),'utf8'));
for(const path of ['src/app/api/natori/admin/payment-link/route.ts','src/app/api/natori/admin/projects/route.ts','src/app/[locale]/natori/quote/[token]/page.tsx']){
 mkdirSync(dirname(resolve(output,path)),{recursive:true});copyFileSync(path,resolve(output,path));checksums[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
}
const fixture='src/app/[locale]/fixture-payment-link/[id]/page.tsx';mkdirSync(dirname(resolve(output,fixture)),{recursive:true});
writeFileSync(resolve(output,fixture),`import Fixture from './fixture';
import {resolveNatoriManagementContext} from '@/features/natori/server/natoriOwner';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 if(process.env.PHASE_2C_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 const context=await resolveNatoriManagementContext();const {id}=await params;
 const {data,error}=await supabaseAdmin().from('natori_projects').select('*').eq('id',id).eq('user_id',context.ownerId).single();
 if(error||!data)throw new Error('Fixture project missing');
 return <Fixture project={{id:data.id,title:data.title,clientName:data.client_name,clientEmail:data.client_email??undefined,type:data.type,amount:data.amount,status:data.status,dueDate:data.due_date,nextAction:data.next_action,tasks:[]}}/>;
}
`);
writeFileSync(resolve(output,dirname(fixture),'fixture.tsx'),`'use client';
import PaymentLinkPanel from '@/features/natori/components/dashboard/PaymentLinkPanel';
import type {NatoriProject} from '@/features/natori/types/projects';
export default function Fixture({project}:{project:NatoriProject}){return <PaymentLinkPanel project={project} onClose={()=>{}} onSent={()=>{}}/>;}
`);
// Only the disposable shell externalizes Stripe so the test-only SDK preload can
// supply a synthetic transport. Production config and application sources are unchanged.
const config=resolve(output,'next.config.mjs');const text=readFileSync(config,'utf8');
if(!text.includes('export default withNextIntl(nextConfig);'))throw new Error('CONFIG_BOUNDARY_CHANGED');
writeFileSync(config,text.replace('export default withNextIntl(nextConfig);',"nextConfig.serverExternalPackages=[...(nextConfig.serverExternalPackages??[]),'stripe'];\nexport default withNextIntl(nextConfig);"));
checksums['fixtureStripeTransport']='test-only externalized SDK adapter, not a real Stripe provider';
writeFileSync(resolve(output,'source-checksums.json'),JSON.stringify(checksums,null,2));
