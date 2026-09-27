// Assemble a disposable Next app from unchanged management sources. Never copy .env.
import { cpSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const output = process.argv[2];
if (!output || !output.includes('/natori-phase-t.') || !output.endsWith('/browser-app')) throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const repo = process.cwd();
mkdirSync(output, {recursive:true});
for (const dir of ['components','features','hooks','i18n','lib','styles','types']) {
  cpSync(resolve(repo,'src',dir),resolve(output,'src',dir),{recursive:true,filter:p=>!p.includes('/__tests__')});
}
const exact = ['src/middleware.ts','src/app/globals.css','src/app/[locale]/layout.tsx',
  'src/app/[locale]/natori/dashboard/page.tsx','src/app/[locale]/natori/dashboard/layout.tsx',
  'src/app/[locale]/natori/projects/page.tsx','src/app/admin-login/page.tsx','src/app/admin-login/AdminLoginClient.tsx',
  ...['projects','events','profile','pricing','page-events','notifications'].map(p=>`src/app/api/natori/admin/${p}/route.ts`),
  'next.config.mjs','tsconfig.json','tailwind.config.js','postcss.config.js','package.json'];
const checksums = {};
for (const path of exact) {
  mkdirSync(dirname(resolve(output,path)),{recursive:true});
  copyFileSync(resolve(repo,path),resolve(output,path));
  checksums[path]=createHash('sha256').update(readFileSync(resolve(output,path))).digest('hex');
}
// Test shell excludes site-wide analytics, Google fonts, gallery overlays; the
// actual dashboard/projects page, authorization, middleware and API are unchanged.
writeFileSync(resolve(output,'src/app/layout.tsx'), `import './globals.css';
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="ja"><body>{children}</body></html>;}
`);
// Test-only form obtains real Supabase sessions with disposable passwords; no
// Google OAuth, production account, preinstalled cookie, or auth mock is used.
mkdirSync(resolve(output,'src/app/api/fixture-session'),{recursive:true});
writeFileSync(resolve(output,'src/app/api/fixture-session/route.ts'), `import {createClient} from '@/lib/supabase/server';
export async function POST(request:Request) {
 if(process.env.PHASE_0B_BROWSER !== 'ephemeral') return new Response(null,{status:404});
 const {email,password}=await request.json();
 if(typeof email !== 'string' || !email.endsWith('@phase0b-browser.invalid')) return new Response(null,{status:400});
 const auth=await createClient(); const {error}=await auth.auth.signInWithPassword({email,password});
 return Response.json({ok:!error},{status:error?401:200});
}
`);
mkdirSync(resolve(output,'src/app/[locale]/fixture-session'),{recursive:true});
writeFileSync(resolve(output,'src/app/[locale]/fixture-session/page.tsx'), `'use client';
import {useState} from 'react';
export default function Page(){const [done,setDone]=useState(false);return <form method="post" onSubmit={async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const r=await fetch('/api/fixture-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:f.get('email'),password:f.get('password')})});setDone(r.ok);}}><label>Email<input name="email" type="email"/></label><label>Password<input name="password" type="password"/></label><button>Sign in</button>{done&&<p>Session ready</p>}</form>;}
`);
writeFileSync(resolve(output,'source-checksums.json'),JSON.stringify(checksums,null,2));
console.log('Prepared unchanged management routes and isolated test-only shell');
