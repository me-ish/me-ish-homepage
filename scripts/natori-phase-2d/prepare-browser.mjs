import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const output = process.argv[2];
if (!output?.includes('/natori-phase-t.') || !output.endsWith('/browser-app')) throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums = JSON.parse(readFileSync(resolve(output, 'source-checksums.json'), 'utf8'));
for (const path of ['src/app/api/webhook/stripe/route.ts', 'src/app/api/natori/admin/projects/route.ts']) {
  mkdirSync(dirname(resolve(output, path)), { recursive: true }); copyFileSync(path, resolve(output, path));
  checksums[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
}
const activeFixture = 'src/app/[locale]/fixture-refund-results/ActiveRefundProject.tsx';
mkdirSync(dirname(resolve(output, activeFixture)), { recursive: true });
writeFileSync(resolve(output, activeFixture), `"use client";
import { useEffect, useState } from 'react';
import ProjectCard from '@/features/natori/components/dashboard/ProjectCard';
import { fetchNatoriProjects } from '@/features/natori/data/supabaseProjects';
import type { NatoriProject } from '@/features/natori/types/projects';
export default function ActiveRefundProject(){
 const [project,setProject]=useState<NatoriProject|null>(null);
 const [failed,setFailed]=useState(false);
 const [notice,setNotice]=useState('');
 useEffect(()=>{
  let mounted=true;
  void fetchNatoriProjects().then(projects=>{
   if(!mounted)return;
   const active=projects.find(project=>project.title==='Browser active refund fixture');
   if(active)setProject(active);else setFailed(true);
  }).catch(()=>{if(mounted)setFailed(true);});
  return()=>{mounted=false;};
 },[]);
 if(failed)return <p role="alert">Active project unavailable</p>;
 if(!project)return <p role="status">Loading active project</p>;
 return <section aria-label="Active refund project">
  <ProjectCard project={project} today={new Date()}
   onToggleTask={(projectId,taskId)=>setNotice(projectId===project.id&&taskId==='active-rough-task'?'Task control active':'Unexpected task callback')}
   onAdvanceStatus={()=>setNotice('Advance control active')}
   onOpenMail={(_,kind)=>setNotice(kind==='rough'?'Rough mail control active':'Delivery mail control active')}/>
  <p role="status">{notice}</p>
 </section>;
}
`);
checksums[activeFixture] = createHash('sha256').update(readFileSync(resolve(output, activeFixture))).digest('hex');
const fixture = 'src/app/[locale]/fixture-refund-results/page.tsx'; mkdirSync(dirname(resolve(output, fixture)), { recursive: true });
writeFileSync(resolve(output, fixture), `import ResultsBoard from '@/features/natori/components/dashboard/ResultsBoard';
import PaymentAttentionPanel from '@/features/natori/components/dashboard/PaymentAttentionPanel';
import ActiveRefundProject from './ActiveRefundProject';
import {resolveNatoriManagementContext} from '@/features/natori/server/natoriOwner';
export const dynamic='force-dynamic';
export default async function Page(){
 if(process.env.PHASE_2D_BROWSER!=='ephemeral')throw new Error('Fixture disabled');
 await resolveNatoriManagementContext();
 return <main><PaymentAttentionPanel/><ResultsBoard/><ActiveRefundProject/></main>;
}
`);
checksums['phase2dFixture'] = 'actual owner auth, actual results/project API, actual refund attention and active ProjectCard; synthetic signed Stripe only';
writeFileSync(resolve(output, 'source-checksums.json'), JSON.stringify(checksums, null, 2));
