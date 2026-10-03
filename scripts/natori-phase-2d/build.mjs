import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
if (!process.argv[2]) throw new Error('Output required');
await build({ entryPoints: ['scripts/natori-phase-2d/integration.ts'], outfile: process.argv[2], platform: 'node', target: 'node22',
  format: 'cjs', bundle: true, external: ['sharp'], alias: {
    'server-only': resolve('scripts/natori-phase-0a/server-only.mjs'),
    'next/headers': resolve('scripts/natori-phase-0b/cookies.ts'),
  } });

// Run every existing Phase 2B assertion again after Phase 2D overrides claim/attention SQL.
// Seed the historical archived-awaiting-payment fixture before Phase 2C is installed:
// quote admission requires an active project, then the pre-2C schema permits archive.
// Persist only synthetic IDs in the runner's existing private ephemeral /state tmpfs.
// Final compatibility reuses that owner and only the archived terminal fixture;
// all original eighteen cases and assertion expressions remain unchanged.
const legacyPath = 'scripts/natori-phase-2b/integration.ts';
let compatibility = readFileSync(legacyPath, 'utf8');
const evidence = '/results/phase2b-integration.json';
if (compatibility.split(evidence).length !== 2 || !compatibility.includes('@phase2b.invalid')) throw new Error('PHASE_2B_COMPATIBILITY_SOURCE_CHANGED');
const replaceFixtureOnce = (source, before, after) => {
  if (source.split(before).length !== 2) throw new Error('PHASE_2B_TERMINAL_FIXTURE_SOURCE_CHANGED');
  return source.replace(before, after);
};
compatibility = replaceFixtureOnce(compatibility,
  "const auth=await db.auth.admin.createUser({email:'owner@phase2b.invalid',password:randomBytes(32).toString('hex'),email_confirm:true});",
  "const prepareLegacy=process.argv.includes('--prepare-terminal-legacy-fixture');\n   const legacyFile='/state/phase2d-terminal-legacy.json';\n   const legacyCache=prepareLegacy?null:JSON.parse(readFileSync(legacyFile,'utf8')) as {ownerId:string;fixture:{projectId:string;quoteId:string;sessionId:string}};\n   if(legacyCache){const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\n    check(uuid.test(legacyCache.ownerId)&&uuid.test(legacyCache.fixture?.projectId)&&uuid.test(legacyCache.fixture?.quoteId)\n     &&/^cs_test_[0-9a-f]{32}$/.test(legacyCache.fixture?.sessionId),'LEGACY_TERMINAL_IDS');}\n   const auth=prepareLegacy?await db.auth.admin.createUser({email:'owner@phase2b.invalid',password:randomBytes(32).toString('hex'),email_confirm:true})\n    :await db.auth.admin.getUserById(legacyCache!.ownerId);");
compatibility = replaceFixtureOnce(compatibility,
  "const owner=auth.data.user!.id;",
  "const owner=auth.data.user!.id;\n   check(auth.data.user!.email==='owner@phase2b.invalid'&&(!legacyCache||owner===legacyCache.ownerId),'LEGACY_TERMINAL_OWNER');");
compatibility = replaceFixtureOnce(compatibility,
  "async function setup(){",
  "async function setup(archivedFixture=false){\n    if(archivedFixture){\n     check(legacyCache,'LEGACY_TERMINAL_CACHE');\n     const row=await db.from('natori_projects').select('id,status,next_action,deleted_at,payment_confirmed_at,payment_quote_id').eq('id',legacyCache!.fixture.projectId).eq('user_id',owner).single();\n     check(!row.error&&row.data?.status==='awaiting_payment'&&row.data.deleted_at&&row.data.next_action==='Keep terminal'\n      &&row.data.payment_confirmed_at===null&&row.data.payment_quote_id===legacyCache!.fixture.quoteId,'LEGACY_TERMINAL_STATE');\n     return legacyCache!.fixture;\n    }");
compatibility = replaceFixtureOnce(compatibility,
  "  await test('signed-sdk-event-records-payment-inbox-and-two-notices-atomically'",
  "   if(prepareLegacy){\n    const fixture=await setup();\n    const archive=await db.from('natori_projects').update({deleted_at:new Date().toISOString(),next_action:'Keep terminal'}).eq('id',fixture.projectId);\n    check(!archive.error,'LEGACY_TERMINAL_PREPARE_ARCHIVE');\n    const prepared=await db.from('natori_projects').select('status,next_action,deleted_at,payment_confirmed_at,payment_quote_id').eq('id',fixture.projectId).eq('user_id',owner).single();\n    check(!prepared.error&&prepared.data?.status==='awaiting_payment'&&prepared.data.deleted_at&&prepared.data.next_action==='Keep terminal'\n     &&prepared.data.payment_confirmed_at===null&&prepared.data.payment_quote_id===fixture.quoteId,'LEGACY_TERMINAL_PREPARE_STATE');\n    writeFileSync(legacyFile,JSON.stringify({ownerId:owner,fixture}),{mode:0o600});\n    console.log('PHASE 2D historical archived awaiting-payment fixture prepared before Phase 2C');\n    return;\n   }\n   await test('signed-sdk-event-records-payment-inbox-and-two-notices-atomically'");
compatibility = replaceFixtureOnce(compatibility,
  "for(const archived of [false,true]){const i=await setup(),e=event(i);await db.from('natori_projects').update(archived?",
  "for(const archived of [false,true]){const i=await setup(archived),e=event(i);const terminalFixture=await db.from('natori_projects').update(archived?");
compatibility = replaceFixtureOnce(compatibility,
  ".eq('id',i.projectId);check((await post(e)).status===200,'ACK');const p=await db.from('natori_projects').select('status,next_action,payment_confirmed_at')",
  ".eq('id',i.projectId);check(!terminalFixture.error,'TERMINAL_FIXTURE_SETUP');check((await post(e)).status===200,'ACK');const p=await db.from('natori_projects').select('status,next_action,payment_confirmed_at')");
compatibility = "process.env.NATORI_REFUND_LEDGER_ENABLED='0';\n" + compatibility
  .replace(evidence, '/results/phase2d-phase2b-compatibility.json').replaceAll('@phase2b.invalid', '@phase2d-compat.invalid');
await build({ stdin: { contents: compatibility, sourcefile: 'integration.ts', loader: 'ts', resolveDir: resolve(dirname(legacyPath)) },
  outfile: resolve(dirname(process.argv[2]), 'phase2b-compatibility.cjs'), platform: 'node', target: 'node22',
  format: 'cjs', bundle: true, external: ['sharp'], alias: {
    'server-only': resolve('scripts/natori-phase-0a/server-only.mjs'),
    'next/headers': resolve('scripts/natori-phase-0b/cookies.ts'),
  } });
