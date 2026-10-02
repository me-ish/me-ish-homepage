import {build} from 'esbuild';
import {resolve,dirname} from 'node:path';
if(!process.argv[2])throw new Error('OUTPUT_REQUIRED');
await build({entryPoints:['scripts/natori-phase-3a/integration.ts'],outfile:process.argv[2],platform:'node',target:'node22',format:'cjs',bundle:true,external:['sharp'],alias:{'server-only':resolve('scripts/natori-phase-0a/server-only.mjs'),'next/headers':resolve('scripts/natori-phase-0b/cookies.ts')}});

await build({entryPoints:['scripts/natori-phase-3a/claim-worker.ts'],outfile:resolve(dirname(process.argv[2]),'claim-worker.cjs'),platform:'node',target:'node22',format:'cjs',bundle:true,external:['sharp'],alias:{'server-only':resolve('scripts/natori-phase-0a/server-only.mjs'),'next/headers':resolve('scripts/natori-phase-0b/cookies.ts')}});

// This helper is mounted under /phase3a, while the disposable Next app owns its pinned sharp dependency under /app.
await build({entryPoints:['scripts/natori-phase-3a/browser-helpers.ts'],outfile:resolve(dirname(process.argv[2]),'browser-helpers.cjs'),platform:'node',target:'node22',format:'cjs',bundle:true,plugins:[{name:'fixture-browser-sharp',setup(builder){builder.onResolve({filter:/^sharp$/},()=>({path:'/app/node_modules/sharp',external:true}));}}],alias:{'server-only':resolve('scripts/natori-phase-0a/server-only.mjs'),'next/headers':resolve('scripts/natori-phase-0b/cookies.ts')}});
