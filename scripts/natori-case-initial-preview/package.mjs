// Local-only, deterministic overlays for this dedicated read-only deployment.
// Does not read credentials, call a network API, upload or deploy anything.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { plan } from './plan.mjs';
import { googlePlan } from './google-plan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const noCronConfiguration = { $schema: 'https://openapi.vercel.sh/vercel.json', crons: [] };
export function readonlyLoginPage(authentication = 'password') {
  if (!['password', 'google'].includes(authentication)) throw Error('initial_preview_authentication_invalid');
  // This server component exists only in the dedicated package. Its fixed
  // nonsecret props cannot grant access; cases and API retain normal auth.
  const actors = ['staff', 'outsider', 'owner'].map(role => ({ ...plan.actors[role],
    label: { staff: '担当者（閲覧確認）', outsider: '権限なし（拒否確認用）', owner: '所有者（認証確認用）' }[role] }));
  return `import "server-only";
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabaseServer';
import { assertInitialPreviewPlatform } from '../../../scripts/natori-case-initial-preview/platform-gate.mjs';
${authentication === 'google' ? "import { assertGoogleReadAccess } from '../../../scripts/natori-case-initial-preview/google-deadline.mjs';" : ''}
import PreviewLogin from './AdminLoginClient';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Page() {
  try { assertInitialPreviewPlatform(process.env); ${authentication === 'google' ? 'assertGoogleReadAccess(process.env);' : ''} } catch { notFound(); }
  const client = await supabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  return <main className="px-4 pt-[72px] pb-8"><PreviewLogin
    currentEmail={error ? null : user?.email ?? null}
    target={${JSON.stringify(plan.target)}} ${authentication === 'password' ? `actors={${JSON.stringify(actors)}}` : ''} /></main>;
}
`;
}
export function readonlySessionLayout(source) {
  if (source.split('return <>').length !== 2 || !source.includes('await requireNatoriAccess("/natori/dashboard")')) throw Error('initial_preview_layout_source_changed');
  return source.replace('return <>', 'return <>\n    <nav aria-label="検証セッション" className="px-4 pt-4 text-sm"><Link href="/admin-login" className="underline">検証ログイン・ログアウト</Link></nav>');
}
export function readonlyGoogleCallback(source) {
  const original = source.replace(/\r\n/g, '\n');
  for (const marker of ['function safeNext(url: URL): string {', 'const next = safeNext(url);', 'await supabase.auth.exchangeCodeForSession(code)']) {
    if (original.split(marker).length !== 2) throw Error('initial_preview_callback_source_changed');
  }
  let callback = original.replace(/function safeNext\(url: URL\): string \{[\s\S]*?\n\}\n/, '')
    .replace('// 同一オリジン or ルート始まりのみ許可（オープンリダイレクト対策）\n// `/login` 側は `?redirect=` を渡してくるので両方受け付ける。\n', '// Dedicated Preview always returns to its fixed protected cases page.\n')
    .replace('  const url = new URL(req.url);', `  try { assertInitialPreviewPlatform(process.env); assertGoogleReadAccess(process.env); } catch { return NextResponse.json({ error: 'initial_readonly_preview_blocked' }, { status: 503 }); }
  const url = new URL(req.url);
  if (url.origin !== ${JSON.stringify(plan.target.origin)} || url.pathname !== ${JSON.stringify(googlePlan.callbackPath)}) return NextResponse.json({ error: 'initial_readonly_preview_blocked' }, { status: 503 });
  if (req.method !== 'GET') return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });`)
    .replace("  const code = url.searchParams.get('code');", "  const codes = url.searchParams.getAll('code');\n  const code = codes.length === 1 && codes[0].length <= 2048 ? codes[0] : null;")
    .replace('const next = safeNext(url);', `const next = ${JSON.stringify(googlePlan.destination)};`)
    .replace('new URL(`/admin-login?err=${encodeURIComponent(oauthErr)}`, url.origin)', "new URL('/admin-login?err=oauth', url.origin)")
    .replace("// code がない場合はそのまま next へ\n    return NextResponse.redirect(new URL(next, url.origin));", "// A callback without a unique code does not establish authentication.\n    return NextResponse.redirect(new URL('/admin-login?err=oauth', url.origin));")
    .replace("} catch (e) {\n    console.error('[auth/callback] exchangeCodeForSession failed:', e);", '} catch {');
  if (callback.includes('console.') || callback.includes('encodeURIComponent(oauthErr)') || callback.includes('safeNext(')) throw Error('initial_preview_callback_source_changed');
  return `import { assertInitialPreviewPlatform } from '../../../../scripts/natori-case-initial-preview/platform-gate.mjs';\nimport { assertGoogleReadAccess } from '../../../../scripts/natori-case-initial-preview/google-deadline.mjs';\n${callback}`;
}
export function readonlyMiddleware(source, authentication = 'password') {
  if (!['password', 'google'].includes(authentication)) throw Error('initial_preview_authentication_invalid');
  const entry = 'export default async function middleware(request: NextRequest) {';
  const config = 'export const config = {';
  if (source.split(entry).length !== 2 || source.split(config).length !== 2
    || !source.trimEnd().endsWith('};')) throw Error('initial_preview_middleware_source_changed');
  const guard = `
  const initialStatus = initialReadonlyDecision({
    environment: process.env.VERCEL_ENV, targetEnvironment: process.env.VERCEL_TARGET_ENV,
    project: process.env.VERCEL_PROJECT_ID, databaseUrl: process.env.SUPABASE_URL,
    publicDatabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    origin: request.nextUrl.origin, pathname: request.nextUrl.pathname,
    method: request.method, imageSource: request.nextUrl.searchParams.get('url'),
    ${authentication === 'google' ? 'googleAccessExpiresAt: process.env.NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT,' : ''}
  }, ${JSON.stringify({ project: plan.target.project, url: plan.target.url, origin: plan.target.origin })}${authentication === 'google' ? ', true' : ''});
  if (initialStatus) return NextResponse.json({ error: 'initial_readonly_preview_blocked' },
    { status: initialStatus, headers: { 'Cache-Control': 'private, no-store' } });
  // These paths were excluded by the normal matcher. Keep their ordinary
  // pass-through after the dedicated guard, rather than sending them to intl.
  if (request.nextUrl.pathname === '/admin-login' || request.nextUrl.pathname.startsWith('/_next/static/')
    || /\\.(?:ico|png|jpe?g|gif|svg|webp|woff2?|ttf|css|js)$/.test(request.nextUrl.pathname))
    return protectPrivateResponse(NextResponse.next(), request.nextUrl.pathname);
`;
  const body = source.slice(0, source.indexOf(config)).replace(entry, entry + guard);
  return `import { initialReadonlyDecision } from './lib/initialReadonlyPreviewGuard';\n${body}
// Catch every route, including dotted paths, server actions and Cron URLs.
export const config = { matcher: ['/:path*'] };\n`;
}

export function buildPackage(output, { authentication = 'password' } = {}) {
  if (!['password', 'google'].includes(authentication)) throw Error('initial_preview_authentication_invalid');
  const out = resolve(output);
  if ((!out.startsWith('/workspace/') && !out.startsWith('/tmp/')) || out.startsWith(root + '/')
    || existsSync(out)) throw Error('initial_preview_fresh_output_required');
  mkdirSync(out, { mode: 0o700 });
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  const rootFiles = new Set(['.eslintrc.json', '.npmrc', 'next.config.mjs', 'package-lock.json', 'package.json',
    'postcss.config.js', 'tailwind.config.js', 'tsconfig.json', 'vercel.json']);
  const files = tracked.filter(p => ['src', 'public', 'patches'].includes(p.split('/')[0]) || rootFiles.has(p));
  const helpers = ['scripts/build-bank-json.mjs', ...['plan.mjs', 'platform-gate.mjs', 'setup.mjs', 'fixture-chronology.mjs', 'password-login.client.tsx',
    'google-plan.mjs', 'google-preflight.mjs', 'google-login.client.tsx', 'google-deadline.mjs']
    .map(p => 'scripts/natori-case-initial-preview/' + p)];
  const members = [...new Set([...files, ...helpers])].sort();
  if (members.some(p => p.includes('..') || p.startsWith('/') || /(^|\/)\.env(?:\.|$)/.test(p))) throw Error('initial_preview_unsafe_source');
  const middleware = readonlyMiddleware(readFileSync(resolve(root, 'src/middleware.ts'), 'utf8'), authentication);
  const overlays = {
    'vercel.json': JSON.stringify(noCronConfiguration, null, 2) + '\n',
    'src/middleware.ts': middleware,
    'src/lib/initialReadonlyPreviewGuard.ts': readFileSync(resolve(root, 'scripts/natori-case-initial-preview/readonly-guard.ts'), 'utf8'),
    'src/lib/google-deadline.mjs': readFileSync(resolve(root, 'scripts/natori-case-initial-preview/google-deadline.mjs'), 'utf8'),
    'src/app/admin-login/page.tsx': readonlyLoginPage(authentication),
    'src/app/admin-login/AdminLoginClient.tsx': readFileSync(resolve(root, `scripts/natori-case-initial-preview/${authentication}-login.client.tsx`), 'utf8'),
    'src/app/[locale]/natori/dashboard/layout.tsx': readonlySessionLayout(readFileSync(resolve(root, 'src/app/[locale]/natori/dashboard/layout.tsx'), 'utf8')),
  };
  if (authentication === 'google') overlays['src/app/auth/callback/route.ts'] = readonlyGoogleCallback(readFileSync(resolve(root, 'src/app/auth/callback/route.ts'), 'utf8'));
  // Verify each selected route has a GET reader. Some existing files also
  // export a writer (case-system); the package-wide guard denies its method
  // before routing. Do not rewrite or resurrect the existing writer itself.
  const guard = overlays['src/lib/initialReadonlyPreviewGuard.ts'];
  const paths = [...guard.matchAll(/'\/api\/[^']+'/g)].map(m => m[0].slice(1, -1));
  if (paths.length !== 7) throw Error('initial_preview_api_inventory_changed');
  for (const p of paths) {
    const route = readFileSync(resolve(root, 'src/app' + p + '/route.ts'), 'utf8');
    if (!/export (?:const GET\s*=|async function GET\s*\(|function GET\s*\()/.test(route)) throw Error('initial_preview_read_route_changed');
  }
  writeFileSync(out + '/archive-members.json', JSON.stringify({ root, members, overlays }));
  execFileSync('python', ['-c', `
import json,tarfile,io,pathlib
p=pathlib.Path(${JSON.stringify(out)}); r=json.loads((p/'archive-members.json').read_text())
with tarfile.open(p/'application-source.tar.gz','w:gz',compresslevel=9) as t:
 for name in sorted(set(r['members'])|set(r['overlays'])):
  if name in r['overlays']:
   b=r['overlays'][name].encode(); m=tarfile.TarInfo(name); m.size=len(b); m.mode=0o644; t.addfile(m,io.BytesIO(b))
  else:
   src=pathlib.Path(r['root'])/name
   assert src.is_file() and not src.is_symlink()
   t.add(src,arcname=name,recursive=False)
with tarfile.open(p/'application-source.tar.gz') as t:
 assert json.loads(t.extractfile('vercel.json').read())['crons']==[]
`]);
  const archive = readFileSync(out + '/application-source.tar.gz');
  const sha256 = createHash('sha256').update(archive).digest('hex');
  const descriptors = [];
  for (let start = 0, i = 0; start < archive.length; start += 2097152, i++) {
    const data = archive.subarray(start, start + 2097152), file = `application-source.part-${String(i).padStart(3, '0')}`;
    writeFileSync(out + '/' + file, data);
    descriptors.push({ file, size: data.length, sha: createHash('sha1').update(data).digest('hex') });
  }
  writeFileSync(out + '/vercel.json', overlays['vercel.json']);
  writeFileSync(out + '/preview-platform-gate.mjs', readFileSync(resolve(root, 'scripts/natori-case-initial-preview/platform-gate.mjs')));
  const inline = p => ({ file: p, data: readFileSync(p === 'package.json' ? root + '/package.json' : out + '/' + p).toString('base64'), encoding: 'base64' });
  const request = { name: 'natori-case-acceptance', project: plan.target.project,
    files: [...descriptors, inline('package.json'), inline('vercel.json'), inline('preview-platform-gate.mjs')],
    projectSettings: { nodeVersion: '22.x', framework: 'nextjs', skipGitConnectDuringLink: true,
      installCommand: `node preview-platform-gate.mjs && cat application-source.part-* > application-source.tar.gz && echo '${sha256}  application-source.tar.gz' | sha256sum -c - && tar -xzf application-source.tar.gz && npm ci --no-audit --no-fund`,
      buildCommand: `node preview-platform-gate.mjs && node scripts/natori-case-initial-preview/${authentication === 'google' ? 'google-preflight' : 'setup'}.mjs && npm run build` },
    meta: { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root }).toString().trim(),
      purpose: 'dedicated-no-cron-read-only-preview', sourceArchiveSHA256: sha256 } };
  writeFileSync(out + '/deployment-request.json', JSON.stringify(request));
  const manifest = { sourceCommit: request.meta.sourceCommit, archiveSHA256: sha256, archiveBytes: archive.length,
    overlayFiles: Object.keys(overlays), configuredCrons: 0, apiReads: paths,
    runtimeMutations: 'all methods other than GET/HEAD denied before normal middleware', authentication,
    middlewareMatcher: '/:path*', earlyPlatformGate: 'before extraction/npm install/setup/build',
    requestTarget: 'omitted per official API Preview default', uploaded: false, deployed: false };
  writeFileSync(out + '/manifest.json', JSON.stringify(manifest, null, 2));
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(buildPackage(process.argv[2] ?? ''), null, 2));
}
