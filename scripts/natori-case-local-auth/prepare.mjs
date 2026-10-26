import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,symlink,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export async function prepare(out) {
 const app=resolve(out,'full-app');await mkdir(app,{recursive:true});
 const config=['package.json','package-lock.json','next.config.mjs','postcss.config.js','tailwind.config.js','tsconfig.json'];
 const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z','--','src','public',...config],{cwd:root,encoding:'utf8',maxBuffer:16*1024*1024}).split('\0').filter(Boolean);
 for(const file of files){
  if(file.split('/').some(part=>part==='.env'||part.startsWith('.env.')))throw Error('environment file copy forbidden');
  const target=resolve(app,file);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(root,file),target);
 }
 await symlink(resolve(root,'node_modules'),resolve(app,'node_modules'),'dir');
 // Next's documented internal test hook replaces only remote Google Font CSS.
 // The app, middleware, authentication helpers, routes and production gate are exact copies.
 await writeFile(out+'/offline-fonts.cjs',`module.exports=new Proxy({}, {get(){return "@font-face {font-family:'Zen Maru Gothic';src:local('Arial');} @font-face {font-family:'Lilita One';src:local('Arial');}"}});`);
 await writeFile(out+'/allow-loopback.cjs',`const net=require('node:net');const fs=require('node:fs');const original=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const o=net._normalizeArgs(args)[0];if(!o.path&&o.host&&!['127.0.0.1','localhost','::1'].includes(o.host)){fs.appendFileSync(${JSON.stringify(out+'/egress-denied.jsonl')},JSON.stringify({host:o.host})+'\\n');throw Error('non-loopback network forbidden');}return original.apply(this,args);};`);
 await build({stdin:{contents:`import {previewEnvelopes} from './scripts/natori-case-preview/fixtureReader';console.log(JSON.stringify(previewEnvelopes()));`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',outfile:out+'/fixtures.mjs',plugins:[{name:'data-generation-only',setup(api){
  api.onResolve({filter:/^(server-only|@\/features\/natori\/server\/(requireNatoriAdmin|trustedNatoriOwner))$/},args=>({path:args.path,namespace:'data-only'}));
  api.onLoad({filter:/.*/,namespace:'data-only'},()=>({contents:`export function resolveNatoriOperator(){throw Error('data generation only')}export function resolveTrustedNatoriOwnerId(){throw Error('data generation only')}`}));
 }}]});
 const envelopes=JSON.parse(execFileSync(process.execPath,[out+'/fixtures.mjs'],{cwd:root,env:{PATH:process.env.PATH,NODE_OPTIONS:'--require='+root+'/scripts/natori-case-preview/deny-network.cjs'},encoding:'utf8'}));
 const proof={app:'tracked full application copied without environment files',files:files.length,sha256:{},substitutions:['Google Font CSS uses local fallback; external CSS fonts blocked in browser','local password SDK bootstrap instead of Google OAuth UI'],auth:'real GoTrue, no Auth or authorization module replacements in app'};
 for(const file of ['src/middleware.ts','src/lib/supabase/server.ts','src/features/natori/server/requireNatoriAdmin.ts','src/features/natori/server/caseWorkspaceRead.ts','next.config.mjs']){
  const actual=await readFile(resolve(app,file)),source=await readFile(resolve(root,file));
  if(!actual.equals(source))throw Error('copied source mismatch');proof.sha256[file]=createHash('sha256').update(actual).digest('hex');
 }
 await writeFile(out+'/preparation.json',JSON.stringify(proof,null,2));
 return {app,envelopes};
}

export async function buildBrowserBootstrap(app,api,anon,target="") {
 await writeFile(app+'/public/__case-local-bootstrap.html','<!doctype html><html lang="ja"><meta charset="utf-8"><title>Local synthetic Auth bootstrap</title><body>Local synthetic password bootstrap<script src="/__case-local-auth.js"></script></body></html>');
 await build({stdin:{contents:`import {supabaseBrowser} from './src/lib/supabaseBrowser';window.localAuth=supabaseBrowser();`,resolveDir:root,loader:'ts'},bundle:true,platform:'browser',format:'iife',outfile:app+'/public/__case-local-auth.js',define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(api),'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY':JSON.stringify(anon),'process.env.NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET':JSON.stringify(target)}});
}
