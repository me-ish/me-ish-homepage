// Construction phase only: retrieve pinned official public assets before the
// Phase T kernel/network seal. No runtime network or live product source edit.
import { readFileSync, writeFileSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const target = process.argv[2], construction = process.argv[3];
if (!target || !/\/natori-phase-t\.[A-Za-z0-9]+\/browser-app$/.test(target) || construction !== '--construction') throw new Error('DEDICATED_CONSTRUCTION_REQUIRED');
if (!existsSync(resolve(target, 'source-checksums.json')) || realpathSync(target) === realpathSync(process.cwd())) throw new Error('VERIFIED_APP_SNAPSHOT_REQUIRED');
const root = dirname(fileURLToPath(import.meta.url)), manifest = JSON.parse(readFileSync(resolve(root, 'font-assets.json'), 'utf8'));
const cssPath = resolve(target, 'src/app/globals.css'), originalCss = readFileSync(cssPath, 'utf8');
// Any Google Fonts @import (or an earlier phase's exclusion comment) is replaced with the
// pinned local faces; with neither present, the faces are prepended. Family/weight choices in
// product CSS are not pinned here.
const remoteFontImport = /^@import url\("https:\/\/fonts\.googleapis\.com\/css2\?[^"\r\n]+"\);[ \t]*\r?$/gm;
const previousExclusion = '/* Isolated browser shell uses system fonts. */';
if ([...originalCss.matchAll(remoteFontImport)].length > 1 || originalCss.split(previousExclusion).length > 2) throw new Error('REVIEWED_GLOBAL_FONT_IMPORT_REQUIRED');
const globalZen = [[400,'Regular'],[500,'Medium'],[700,'Bold'],[900,'Black']].map(([weight,name]) => `@font-face{font-family:'Zen Maru Gothic';font-style:normal;font-weight:${weight};font-display:swap;src:url('/phase7-fonts/zenmarugothic/ZenMaruGothic-${name}.ttf') format('truetype');}`).join('\n');
const pinnedFaces = `/* Isolated pinned official fonts; unrelated global families are unused by these Natori surfaces. */\n${globalZen}`;
const strippedCss = originalCss.replace(remoteFontImport, previousExclusion);
const fixtureCss = strippedCss.includes(previousExclusion)
  ? strippedCss.replace(previousExclusion, pinnedFaces)
  : `${pinnedFaces}\n${strippedCss}`;
if (/@import[^;]*https?:\/\//i.test(fixtureCss)) throw new Error('UNREVIEWED_REMOTE_CSS_IMPORT');
const actualLayout = readFileSync(resolve('src/app/layout.tsx'), 'utf8');
// Inherit whatever body classes the actual root layout uses (not a fixed class list).
const bodyMatches = [...actualLayout.matchAll(/<body className="[^"]*">/g)];
if (bodyMatches.length !== 1) throw new Error('ACTUAL_ROOT_BODY_TYPOGRAPHY_REVIEW_REQUIRED');
const bodyTag = bodyMatches[0][0];
const shellPath = resolve(target, 'src/app/layout.tsx'), shell = readFileSync(shellPath, 'utf8');
if (shell.split('<body>').length !== 2) throw new Error('REVIEWED_TEST_SHELL_REQUIRED');
const typedShell = shell.replace('<body>', bodyTag);


if (!Array.isArray(manifest) || manifest.length !== 7) throw new Error('FONT_MANIFEST_REJECTED');
const prepared = [];
for (const asset of manifest) {
  if (!['fredoka', 'zenmarugothic'].includes(asset.family) || !/^[a-f0-9]{40}$/.test(asset.commit)
    || !/^[a-f0-9]{64}$/.test(asset.sha256) || !/^[a-f0-9]{40}$/.test(asset.git_blob_sha1)
    || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1000 || asset.bytes > 8000000) throw new Error('FONT_MANIFEST_REJECTED');
  const expected = `https://raw.githubusercontent.com/google/fonts/${asset.commit}/ofl/${asset.family}/${encodeURIComponent(asset.name)}`;
  if (asset.url !== expected || !/^(OFL\.txt|Fredoka\[wdth,wght\]\.ttf|ZenMaruGothic-(Regular|Medium|Bold|Black)\.ttf)$/.test(asset.name)) throw new Error('FONT_URL_REJECTED');
  const response = await fetch(expected, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error('PINNED_FONT_DOWNLOAD_FAILED');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== asset.bytes || createHash('sha256').update(buffer).digest('hex') !== asset.sha256
    || createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex') !== asset.git_blob_sha1) throw new Error('PINNED_FONT_DIGEST_MISMATCH');
  const name = asset.name === 'Fredoka[wdth,wght].ttf' ? 'Fredoka-variable.ttf' : asset.name;
  prepared.push({ relative: `public/phase7-fonts/${asset.family}/${name}`, buffer, sha256: asset.sha256 });
}
prepared.push({ relative: 'src/app/globals.css', buffer: Buffer.from(fixtureCss), sha256: createHash('sha256').update(fixtureCss).digest('hex'), replaceReviewedCss: true });
prepared.push({ relative: 'src/app/layout.tsx', buffer: Buffer.from(typedShell), sha256: createHash('sha256').update(typedShell).digest('hex'), replaceReviewedCss: true });
const mock = readFileSync(resolve(root, 'font-responses.cjs'));
prepared.push({ relative: 'phase7-font-responses.cjs', buffer: mock, sha256: createHash('sha256').update(mock).digest('hex') });
for (const item of prepared) {
  const path = resolve(target, item.relative);
  if (!item.replaceReviewedCss && existsSync(path) && createHash('sha256').update(readFileSync(path)).digest('hex') !== item.sha256) throw new Error('FONT_DESTINATION_CHANGED');
}
const checksumPath = resolve(target, 'source-checksums.json'), checksums = JSON.parse(readFileSync(checksumPath, 'utf8'));
for (const item of prepared) { const path = resolve(target, item.relative); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, item.buffer); checksums[item.relative] = item.sha256; }
checksums.phase7ShellTypography = { actual_root_source_sha256: createHash('sha256').update(actualLayout).digest('hex'), fixture_root_sha256: createHash('sha256').update(typedShell).digest('hex'), body_class: bodyTag.slice('<body className="'.length, -2), shell: 'Inherited actual body classes; existing test shell excludes global analytics/chrome' };
checksums.phase7GlobalCssTransport = { original_sha256: createHash('sha256').update(originalCss).digest('hex'), fixture_sha256: createHash('sha256').update(fixtureCss).digest('hex'), semantics: 'Remote font @import (if any) replaced only in disposable shell with pinned Zen faces; product CSS remains unchanged' };
checksums.phase7Fonts = { source: 'Official google/fonts pinned commits; Git blob SHA1 + SHA256 verified during construction', delivery: 'Full TTF via installed Next font CSS test transport, no Google network at runtime', productFontSourceUnchanged: true };
writeFileSync(checksumPath, JSON.stringify(checksums, null, 2));
