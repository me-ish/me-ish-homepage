import {build} from 'esbuild';
import {mkdir,writeFile,readFile,symlink} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(import.meta.url);
const out=resolve(process.argv[2]);if(!out.startsWith('/workspace/')&&!out.startsWith('/tmp/'))throw Error('local output required');
await mkdir(out,{recursive:true});
await build({stdin:{contents:`import {previewEnvelopes} from './scripts/natori-case-preview/fixtureReader';import {CASE_WORKSPACE_MIGRATION_FILE as migrationFile,renderCaseWorkspaceMigration} from './scripts/natori-case-preview/readContract';console.log(JSON.stringify({envelopes:previewEnvelopes(),migrationFile,migration:renderCaseWorkspaceMigration()}));`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',target:'node22',outfile:resolve(out,'fixtures.mjs'),plugins:[{name:'data-generation-only',setup(api){
 api.onResolve({filter:/^(server-only|@\/features\/natori\/server\/(requireNatoriAdmin|trustedNatoriOwner))$/},args=>({path:args.path,namespace:'synthetic-data-only'}));
 api.onLoad({filter:/.*/,namespace:'synthetic-data-only'},()=>({contents:`export function resolveNatoriOperator(){throw Error('data-generation only')}export function resolveTrustedNatoriOwnerId(){throw Error('data-generation only')}`}));
}}]});
const data=execFileSync(process.execPath,[resolve(out,'fixtures.mjs')],{cwd:root,env:{PATH:process.env.PATH,NODE_OPTIONS:`--require=${root}/scripts/natori-case-preview/deny-network.cjs`}});
await writeFile(resolve(out,'fixtures.json'),data);
const app=resolve(out,'app-fixture');await mkdir(resolve(app,'app/natori/dashboard/cases'),{recursive:true});await mkdir(resolve(app,'app/api/natori/admin/case-workspace'),{recursive:true});await mkdir(resolve(app,'app/admin-login'),{recursive:true});
try{await symlink(resolve(root,'node_modules'),resolve(app,'node_modules'),'dir');}catch(error){if(error.code!=='EEXIST')throw error;}
await writeFile(resolve(app,'package.json'),JSON.stringify({name:'isolated-case-read-app',version:'1.0.0',private:true,dependencies:{next:'15.5.27',react:'18.2.0','react-dom':'18.2.0'}}));
await writeFile(resolve(app,'tsconfig.json'),JSON.stringify({compilerOptions:{jsx:'preserve',strict:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',target:'ES2017',lib:['dom','esnext'],paths:{'@/*':[root+'/src/*']},skipLibCheck:true},include:['**/*.ts','**/*.tsx']}));
await writeFile(resolve(app,'next.config.mjs'),`export default {experimental:{externalDir:true},webpack(config){config.resolve.alias['@']=${JSON.stringify(root+'/src')};return config;}};`);
await writeFile(resolve(app,'app/layout.tsx'),`import './style.css';export default function Layout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>}`);
await writeFile(resolve(app,'app/natori/dashboard/layout.tsx'),`export {default} from '@/app/[locale]/natori/dashboard/layout';`);
await writeFile(resolve(app,'app/natori/dashboard/cases/page.tsx'),`export {default} from '@/app/[locale]/natori/dashboard/cases/page';export const dynamic='force-dynamic';`);
await writeFile(resolve(app,'app/api/natori/admin/case-workspace/route.ts'),`export {GET} from '@/app/api/natori/admin/case-workspace/route';export const dynamic='force-dynamic';export const runtime='nodejs';`);
await writeFile(resolve(app,'app/admin-login/page.tsx'),`export default function Login(){return <h1>隔離検証・ログインが必要です</h1>}`);
execFileSync(process.execPath,[require.resolve('tailwindcss/lib/cli.js'),'-i',root+'/scripts/natori-case-preview/base.css','-o',app+'/app/style.css','--content',root+'/src/features/natori/components/caseWorkspace/**/*.tsx,'+root+'/src/features/natori/constants/adminUi.ts','--minify'],{cwd:root,stdio:'pipe'});
await writeFile(resolve(out,'allow-local.cjs'),`const net=require('node:net');const original=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const value=args[0],host=value&&typeof value==='object'?value.host:args[1];if(host&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('nonlocal network blocked');return original.apply(this,args);};`);
console.log(JSON.stringify({output:out,fixtures:'synthetic only',realAuthModules:true}));
