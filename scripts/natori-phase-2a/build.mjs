import { build } from 'esbuild';
import { resolve } from 'node:path';
if (!process.argv[2]) throw new Error('Output required');
await build({ entryPoints: ['scripts/natori-phase-2a/integration.ts'], outfile: process.argv[2], platform: 'node', target: 'node22',
  format: 'cjs', bundle: true, external: ['sharp'], alias: {
    'server-only': resolve('scripts/natori-phase-0a/server-only.mjs'),
    'next/headers': resolve('scripts/natori-phase-0b/cookies.ts'),
  } });
