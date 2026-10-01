import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output?.includes('/natori-phase-t.')||!output.endsWith('/browser-app'))throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums=JSON.parse(readFileSync(resolve(output,'source-checksums.json'),'utf8'));
for(const path of ['src/app/api/natori/admin/estimate-draft/route.ts','src/app/api/natori/admin/structured-quote/route.ts','src/app/api/natori/admin/quote-notification/route.ts']){
 mkdirSync(dirname(resolve(output,path)),{recursive:true});copyFileSync(path,resolve(output,path));checksums[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
}
const fixture='src/app/[locale]/fixture-estimate/[id]/page.tsx';mkdirSync(dirname(resolve(output,fixture)),{recursive:true});
writeFileSync(resolve(output,fixture),`import EstimateJourney from '@/features/natori/components/dashboard/EstimateJourney';
import {resolveNatoriManagementContext} from '@/features/natori/server/natoriOwner';
import {supabaseAdmin} from '@/lib/supabaseAdmin';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 if(process.env.PHASE_2A_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 const context=await resolveNatoriManagementContext();const {id}=await params;
 const {data,error}=await supabaseAdmin().from('natori_projects').select('id,title,client_name,client_email,type,amount,status,due_date,next_action,payment_confirmed_at').eq('id',id).eq('user_id',context.ownerId).single();
 if(error||!data)throw new Error('Fixture project missing');
 return <EstimateJourney portfolioContent={null} project={{id:data.id,title:data.title,clientName:data.client_name,clientEmail:data.client_email??undefined,type:data.type,amount:data.amount,status:data.status,dueDate:data.due_date,nextAction:data.next_action,tasks:[],paymentConfirmedAt:data.payment_confirmed_at??undefined}}/>;
}
`);
writeFileSync(resolve(output,'source-checksums.json'),JSON.stringify(checksums,null,2));
