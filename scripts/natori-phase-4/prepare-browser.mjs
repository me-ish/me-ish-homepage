import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const output = process.argv[2];
if (!output?.includes('/natori-phase-t.') || !output.endsWith('/browser-app')) throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums = JSON.parse(readFileSync(resolve(output, 'source-checksums.json'), 'utf8'));
for (const path of [
  'src/app/[locale]/natori/inquiries/page.tsx',
  'src/app/[locale]/natori/consult/[token]/page.tsx',
  'src/app/api/natori/consult/[token]/route.ts',
  'src/app/api/natori/consult/[token]/renew/route.ts',
  'src/app/api/natori/admin/consultation/route.ts',
]) {
  mkdirSync(dirname(resolve(output, path)), { recursive: true });
  copyFileSync(path, resolve(output, path));
  checksums[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
}
writeFileSync(resolve(output, 'source-checksums.json'), JSON.stringify(checksums, null, 2));
