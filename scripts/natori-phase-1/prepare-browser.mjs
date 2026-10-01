import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
const output = process.argv[2];
if (!output?.includes('/natori-phase-t.') || !output.endsWith('/browser-app')) throw new Error('DEDICATED_DIRECTORY_REQUIRED');
const checksums = JSON.parse(readFileSync(resolve(output, 'source-checksums.json'), 'utf8'));
for (const path of ['src/app/api/natori/admin/delivery-files/route.ts', 'src/app/api/natori/admin/order-mail/route.ts']) {
  mkdirSync(dirname(resolve(output, path)), { recursive: true }); copyFileSync(path, resolve(output, path));
  checksums[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
}
// The isolated browser shell already excludes remote fonts. The shared source
// CSS still imports Google Fonts, whose blocked child request rejects React's
// local stylesheet preload with a raw Event during router.refresh/HMR.
// Remove only this reviewed import from the disposable copy, retaining every
// application CSS rule and recording both source and fixture checksums.
const cssPath = 'src/app/globals.css';
const sourceCss = readFileSync(resolve(output, cssPath), 'utf8');
const fontImport = /^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?[^"\r\n]+"\);[ \t]*\r?$/gm;
if ([...sourceCss.matchAll(fontImport)].length !== 1) throw new Error('REVIEW_FONT_IMPORT_REQUIRED');
const fixtureCss = sourceCss.replace(fontImport, '/* Isolated browser shell uses system fonts. */');
if (/@import[^;]*https?:\/\//i.test(fixtureCss)) throw new Error('UNREVIEWED_REMOTE_CSS_IMPORT');
writeFileSync(resolve(output, 'phase1-source-globals.css'), sourceCss);
checksums['phase1-source-globals.css'] = createHash('sha256').update(sourceCss).digest('hex');
writeFileSync(resolve(output, cssPath), fixtureCss);
checksums[cssPath] = createHash('sha256').update(fixtureCss).digest('hex');
console.log('Phase 1 browser shell: one remote font import excluded; application CSS preserved');
copyFileSync('next.config.mjs', resolve(output, 'phase1-source-config.mjs'));
checksums['phase1-source-config.mjs'] = checksums['next.config.mjs'];
// Independent dev build caches: Phase N stops before Phase 1 starts in this app.
// Never reuse stylesheet/chunk state across processes with different feature flags.
const wrapper = "import original from './phase1-source-config.mjs';\nexport default {...original, devIndicators: false, distDir: process.env.NATORI_DELIVERY_INTEGRITY_ENABLED === '1' ? 'phase1-next' : 'phase-n-next'};\n";
writeFileSync(resolve(output, 'next.config.mjs'), wrapper);
checksums['next.config.mjs'] = createHash('sha256').update(wrapper).digest('hex');
writeFileSync(resolve(output, 'source-checksums.json'), JSON.stringify(checksums, null, 2));
