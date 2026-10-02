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
// Adapt only legacy fixture creation to the subsequently installed Phase 2C guard;
// every original Phase 2B assertion and its terminal status expectation stays intact.
// Existing pre-2C archived awaiting-payment projects remain valid legacy records,
// while a newly archived awaiting-payment UPDATE is intentionally forbidden.
const legacyPath = 'scripts/natori-phase-2b/integration.ts';
let compatibility = readFileSync(legacyPath, 'utf8');
const evidence = '/results/phase2b-integration.json';
if (compatibility.split(evidence).length !== 2 || !compatibility.includes('@phase2b.invalid')) throw new Error('PHASE_2B_COMPATIBILITY_SOURCE_CHANGED');
const replaceFixtureOnce = (source, before, after) => {
  if (source.split(before).length !== 2) throw new Error('PHASE_2B_TERMINAL_FIXTURE_SOURCE_CHANGED');
  return source.replace(before, after);
};
compatibility = replaceFixtureOnce(compatibility,
  'async function setup(){', 'async function setup(archivedFixture=false){');
compatibility = replaceFixtureOnce(compatibility,
  "status:'inquiry',amount:12000,quoted_amount:12000}).select('id').single()",
  "status:'inquiry',amount:12000,quoted_amount:12000,...(archivedFixture?{deleted_at:new Date().toISOString()}: {})}).select('id').single()");
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
