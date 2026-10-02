import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const output=process.argv[2];
if(!output?.includes('/natori-phase-t.')||!output.endsWith('/browser-app'))throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums=JSON.parse(readFileSync(resolve(output,'source-checksums.json'),'utf8'));
for(const path of ['src/app/api/natori/admin/projects/route.ts','src/features/natori/components/dashboard/ProjectsBoard.tsx',
 'src/features/natori/lib/taskProjection.ts','src/features/natori/lib/projectReadModel.ts','src/features/natori/server/taskIntegrityService.ts']){
 mkdirSync(dirname(resolve(output,path)),{recursive:true});copyFileSync(path,resolve(output,path));
 checksums[path]=createHash('sha256').update(readFileSync(path)).digest('hex');
}
const fixture='src/app/[locale]/fixture-task-board/page.tsx';mkdirSync(dirname(resolve(output,fixture)),{recursive:true});
writeFileSync(resolve(output,fixture),`import ProjectsBoard from '@/features/natori/components/dashboard/ProjectsBoard';
import {resolveNatoriManagementContext} from '@/features/natori/server/natoriOwner';
export const dynamic='force-dynamic';
export default async function Page(){
 if(process.env.PHASE_6A_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 await resolveNatoriManagementContext();return <ProjectsBoard/>;
}
`);
checksums['fixtureTaskBoard']='test-only route; unchanged real board, task API and authentication';
writeFileSync(resolve(output,'source-checksums.json'),JSON.stringify(checksums,null,2));
