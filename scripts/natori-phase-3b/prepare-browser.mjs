import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];if(!output?.includes('/natori-phase-t.')||!output.endsWith('/browser-app'))throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums=JSON.parse(readFileSync(resolve(output,'source-checksums.json'),'utf8'));
for(const path of ['src/app/api/natori/admin/consultation/route.ts','src/app/api/natori/consult/[token]/route.ts','src/app/api/natori/consultation-file/route.ts','src/app/[locale]/natori/consult/[token]/page.tsx']){mkdirSync(dirname(resolve(output,path)),{recursive:true});copyFileSync(path,resolve(output,path));checksums[path]=createHash('sha256').update(readFileSync(path)).digest('hex');}
const fixture='src/app/[locale]/fixture-consultation/[id]/page.tsx';mkdirSync(dirname(resolve(output,fixture)),{recursive:true});
writeFileSync(resolve(output,fixture),`import ConsultationThread from '@/features/natori/components/consultation/ConsultationThread';
import {getStaffConsultation} from '@/features/natori/server/consultationService';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){
 if(process.env.PHASE_3B_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 const {id}=await params,view=await getStaffConsultation(id);if(!view)throw new Error('Fixture project missing');
 return <main className="mx-auto max-w-2xl p-4"><ConsultationThread mode="staff" projectId={id} clientEmail={view.project.client_email??undefined}/></main>;
}`);
writeFileSync(resolve(output,'source-checksums.json'),JSON.stringify(checksums,null,2));
