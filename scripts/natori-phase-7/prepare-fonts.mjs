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
const reviewedImport = "@import url(\"https://fonts.googleapis.com/css2?family=Lilita+One&family=Zen+Maru+Gothic&family=Noto+Sans+JP:wght@400;500;700&family=Shippori+Mincho:wght@400;600&family=Mochiy+Pop+One&family=DotGothic16&family=Share+Tech+Mono&display=swap\");";
const previousExclusion = '/* Isolated browser shell uses system fonts. */';
const cssAnchor = originalCss.includes(reviewedImport) ? reviewedImport : previousExclusion;
if (originalCss.split(cssAnchor).length !== 2) throw new Error('REVIEWED_GLOBAL_FONT_IMPORT_REQUIRED');
const globalZen = [[400,'Regular'],[500,'Medium'],[700,'Bold'],[900,'Black']].map(([weight,name]) => `@font-face{font-family:'Zen Maru Gothic';font-style:normal;font-weight:${weight};font-display:swap;src:url('/phase7-fonts/zenmarugothic/ZenMaruGothic-${name}.ttf') format('truetype');}`).join('\n');
const fixtureCss = originalCss.replace(cssAnchor, `/* Isolated pinned official fonts; unrelated global families are unused by these Natori surfaces. */\n${globalZen}`);
if (/@import[^;]*https?:\/\//i.test(fixtureCss)) throw new Error('UNREVIEWED_REMOTE_CSS_IMPORT');
const actualLayout = readFileSync(resolve('src/app/layout.tsx'), 'utf8');
const bodyTag = '<body className="font-zen text-lg leading-relaxed text-[#333]">';
if (actualLayout.split(bodyTag).length !== 2) throw new Error('ACTUAL_ROOT_BODY_TYPOGRAPHY_REVIEW_REQUIRED');
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
checksums.phase7ShellTypography = { actual_root_source_sha256: createHash('sha256').update(actualLayout).digest('hex'), fixture_root_sha256: createHash('sha256').update(typedShell).digest('hex'), body_class: 'font-zen text-lg leading-relaxed text-[#333]', shell: 'Inherited actual body classes; existing test shell excludes global analytics/chrome' };
checksums.phase7GlobalCssTransport = { original_sha256: createHash('sha256').update(originalCss).digest('hex'), fixture_sha256: createHash('sha256').update(fixtureCss).digest('hex'), semantics: 'Exact remote @import replaced only in disposable shell with pinned Zen faces; product CSS remains unchanged' };
checksums.phase7Fonts = { source: 'Official google/fonts pinned commits; Git blob SHA1 + SHA256 verified during construction', delivery: 'Full TTF via installed Next font CSS test transport, no Google network at runtime', productFontSourceUnchanged: true };
writeFileSync(checksumPath, JSON.stringify(checksums, null, 2));
