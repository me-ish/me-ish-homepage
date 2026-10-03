import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const target = process.argv[2];
if (!target || !/\/natori-phase-t\.[A-Za-z0-9]+\/phase7\/fixtures\.cjs$/.test(target)) throw new Error('DEDICATED_DIRECTORY_REQUIRED');
mkdirSync(dirname(target), { recursive: true });
const result = await build({ entryPoints: ['scripts/natori-phase-7/fixtures.ts'], bundle: true, platform: 'node', format: 'cjs', target: 'node22', outfile: target, metafile: true, logLevel: 'silent' });
const inputs = Object.fromEntries(Object.keys(result.metafile.inputs).map(path => [path, createHash('sha256').update(readFileSync(resolve(path))).digest('hex')]));
writeFileSync(resolve(dirname(target), 'source-checksums.json'), JSON.stringify({ inputs, output: createHash('sha256').update(readFileSync(target)).digest('hex'), semantics: 'Actual product default/parser imports; synthetic artwork/request/conditions and public legacy workflow only' }, null, 2));
