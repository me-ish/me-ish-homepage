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
// Change only disposable fixture addresses and the evidence path; never alter assertions.
const legacyPath = 'scripts/natori-phase-2b/integration.ts';
let compatibility = readFileSync(legacyPath, 'utf8');
const evidence = '/results/phase2b-integration.json';
if (compatibility.split(evidence).length !== 2 || !compatibility.includes('@phase2b.invalid')) throw new Error('PHASE_2B_COMPATIBILITY_SOURCE_CHANGED');
compatibility = "process.env.NATORI_REFUND_LEDGER_ENABLED='0';\n" + compatibility
  .replace(evidence, '/results/phase2d-phase2b-compatibility.json').replaceAll('@phase2b.invalid', '@phase2d-compat.invalid');
await build({ stdin: { contents: compatibility, sourcefile: 'integration.ts', loader: 'ts', resolveDir: resolve(dirname(legacyPath)) },
  outfile: resolve(dirname(process.argv[2]), 'phase2b-compatibility.cjs'), platform: 'node', target: 'node22',
  format: 'cjs', bundle: true, external: ['sharp'], alias: {
    'server-only': resolve('scripts/natori-phase-0a/server-only.mjs'),
    'next/headers': resolve('scripts/natori-phase-0b/cookies.ts'),
  } });
