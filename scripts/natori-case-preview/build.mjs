import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url), root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const out=resolve(process.argv[2]??'/tmp/natori-case-preview');
if(!out.startsWith('/workspace/')&&!out.startsWith('/tmp/'))throw new Error('Local output directory required');
await mkdir(out,{recursive:true});
await build({entryPoints:[resolve(root,'scripts/natori-case-preview/fixtureMain.ts')],bundle:true,platform:'node',format:'esm',target:'node22',outfile:resolve(out,'fixture-reader.mjs'),plugins:[{
  name:'fixture-only-authorization',setup(api){
    api.onResolve({filter:/^(server-only|@\/features\/natori\/server\/(requireNatoriAdmin|trustedNatoriOwner))$/},args=>({path:args.path,namespace:'fixture-only'}));
    api.onLoad({filter:/.*/,namespace:'fixture-only'},()=>({contents:`export function resolveNatoriOperator(){throw new Error('Fixture management scope required')} export function resolveTrustedNatoriOwnerId(){throw new Error('Fixture management scope required')}`,loader:'js'}));
  },
}]});
const fixtureData=execFileSync(process.execPath,[resolve(out,'fixture-reader.mjs')],{cwd:root,maxBuffer:10*1024*1024,env:{PATH:process.env.PATH,LANG:'C.UTF-8',NODE_OPTIONS:`--require=${resolve(root,'scripts/natori-case-preview/deny-network.cjs')}`}});
await writeFile(resolve(out,'fixtures.bundle.json'),fixtureData);
await build({entryPoints:[resolve(root,'scripts/natori-case-preview/entry.tsx')],bundle:true,platform:'browser',format:'esm',jsx:'automatic',target:'es2020',minify:true,outfile:resolve(out,'app.js'),metafile:true,write:true}).then(async result=>writeFile(resolve(out,'bundle-meta.json'),JSON.stringify(result.metafile,null,2)));
execFileSync(process.execPath,[require.resolve('tailwindcss/lib/cli.js'),'-i',resolve(root,'scripts/natori-case-preview/base.css'),'-o',resolve(out,'styles.css'),'--content',`${root}/src/features/natori/components/caseWorkspace/**/*.tsx,${root}/src/features/natori/constants/adminUi.ts,${root}/src/features/natori/constants/natoriPrimaryAction.ts`,'--minify'],{cwd:root,stdio:'pipe'});
await writeFile(resolve(out,'index.html'),'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>natori · 架空案件ワークスペース</title><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
process.stdout.write(JSON.stringify({output:out,syntheticCases:8,applicationRoutesAdded:0})+'\n');
