const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync, mkdirSync, writeFileSync, copyFileSync, mkdtempSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const { runInThisContext } = require('node:vm');
const { resolve, dirname } = require('node:path');
const { execFileSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const loaderPath = require.resolve('next/dist/compiled/@next/font/dist/google/loader');
const realRequire = createRequire(loaderPath);
const patched = readFileSync(loaderPath, 'utf8');
const patch = readFileSync(resolve(root, 'patches/next+15.5.28.patch'), 'utf8');
const added = patch.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)).join('\n');
const removed = patch.split('\n').filter(l => l.startsWith('-') && !l.startsWith('---')).map(l => l.slice(1)).join('\n');
const original = patched.replace(added, removed);
const sha = value => createHash('sha256').update(value).digest('hex');
const realTtf = readFileSync(resolve(root, 'public/fonts/ZenMaruGothic-Bold.ttf'));
const realWoff = readFileSync(resolve(root, 'public/fonts/subset-ZenMaruGothic-Regular.woff'));
const realWoff2 = readFileSync(resolve(root, 'public/fonts/subset-ZenMaruGothic-Regular.woff2'));
// Stub only remote transport; run the actual pinned production loader and validators.
function load(source, url, buffer) {
  let fetches = 0;
  const mod = { exports: {} };
  const css = `/* latin */\n@font-face {font-family:'Fredoka';font-style:normal;font-weight:400 700;font-display:swap;src: url(${url}) format('truetype');}`;
  const req = name => name === './fetch-css-from-google-fonts' ? { fetchCSSFromGoogleFonts: async () => css }
    : name === './fetch-font-file' ? { fetchFontFile: async () => { fetches++; return buffer; } } : realRequire(name);
  runInThisContext(`(function(exports,require,module,__filename,__dirname){${source}\n})`)(mod.exports, req, mod, loaderPath, dirname(loaderPath));
  const emitted = [];
  return { emitted, fetches: () => fetches, run: () => mod.exports.default({
    functionName: 'Fredoka', data: [{ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--pf-font-en', display: 'swap' }],
    isDev: false, isServer: true,
    emitFontFile: (bytes, ext, preload, fallback) => { emitted.push({ bytes, ext, preload, fallback }); return '/_next/static/media/font.' + ext; },
  }) };
}

test('patch is confined to the pinned loader; original production failure reproduces', async () => {
  assert.equal(require('next/package.json').version, '15.5.28');
  assert.equal(sha(original), '45e38a6da7efde1a8f53c29619af2eb8f202d352119dbc91c7714db07db385f4');
  for (const url of ['https://fonts.gstatic.com/l/font?kit=fixture&skey=fixture&v=v1', 'https://fonts.gstatic.com/font.woff2?v=1']) {
    const old = load(original, url, realWoff2);
    await assert.rejects(old.run(), /Cannot read properties of null \(reading '1'\)/);
    assert.equal(old.emitted.length, 0);
  }
});

for (const [format, bytes] of [['ttf', realTtf], ['woff', realWoff], ['woff2', realWoff2], ['otf', Buffer.concat([Buffer.from('OTTO'), Buffer.alloc(12)])]]) {
  test(`suffixless/query URLs preserve ${format} bytes, CSS, preload, fallback and cache`, async () => {
    for (const url of ['https://fonts.gstatic.com/l/font?kit=fixture&v=v1', `https://fonts.gstatic.com/font.${format}?v=1`]) {
      const current = load(patched, url, bytes);
      const first = await current.run(); const second = await current.run();
      assert.deepEqual(first, second); assert.equal(current.fetches(), 1);
      assert.equal(first.variable, '--pf-font-en'); assert.ok(first.adjustFontFallback);
      assert.match(first.css, /font-weight:400 700/); assert.match(first.css, /font-display:swap/);
      assert.ok(!first.css.includes('fonts.gstatic.com'));
      for (const out of current.emitted) {
        assert.equal(out.ext, format); assert.deepEqual(out.bytes, bytes);
        assert.equal(out.preload, true); assert.equal(out.fallback, true);
      }
    }
  });
}

test('ordinary extension URL keeps the original result and emitted bytes exactly', async () => {
  for (const [format, bytes] of [['ttf',realTtf],['woff',realWoff],['woff2',realWoff2]]) {
    const old = load(original, `https://fonts.gstatic.com/font.${format}`, bytes);
    const current = load(patched, `https://fonts.gstatic.com/font.${format}`, bytes);
    assert.deepEqual(await current.run(), await old.run()); assert.deepEqual(current.emitted, old.emitted);
  }
});

test('unrecognized/truncated response never silently emits a font or succeeds in production', async () => {
  for (const bytes of [Buffer.from('<html>upstream error</html>'), Buffer.alloc(0), Buffer.from('wOF2')]) {
    const current = load(patched, 'https://fonts.gstatic.com/l/font?kit=fixture', bytes);
    await assert.rejects(current.run(), /Unsupported font format received for `Fredoka`/);
    assert.equal(current.emitted.length, 0);
  }
  const missing = load(patched, 'https://fonts.gstatic.com/l/font?kit=fixture', null);
  await assert.rejects(missing.run(), /Failed to fetch `Fredoka`/);
  assert.equal(missing.emitted.length, 0);
});

test('postinstall applies to pristine installed Next and is idempotent, offline', () => {
  const fixture = mkdtempSync('/workspace/next-font-install-check-');
  const target = resolve(fixture, 'node_modules/next/dist/compiled/@next/font/dist/google/loader.js');
  mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, original);
  writeFileSync(resolve(fixture, 'node_modules/next/package.json'), JSON.stringify({ name: 'next', version: '15.5.28' }));
  writeFileSync(resolve(fixture, 'package.json'), JSON.stringify({ name: 'font-install-check', version: '1.0.0', dependencies: { next: '15.5.28' } }));
  writeFileSync(resolve(fixture, 'package-lock.json'), JSON.stringify({ name: 'font-install-check', version: '1.0.0', lockfileVersion: 3, packages: { '': { dependencies: { next: '15.5.28' } }, 'node_modules/next': { version: '15.5.28' } } }));
  mkdirSync(resolve(fixture, 'patches')); copyFileSync(resolve(root, 'patches/next+15.5.28.patch'), resolve(fixture, 'patches/next+15.5.28.patch'));
  for (let i = 0; i < 2; i++) {
    execFileSync(process.execPath, [require.resolve('patch-package/index.js'), '--error-on-fail'], { cwd: fixture, env: { PATH: dirname(process.execPath), NODE_OPTIONS: '--require=' + resolve(root, 'scripts/natori-case-preview/deny-network.cjs') }, stdio: 'pipe' });
    assert.equal(readFileSync(target, 'utf8'), patched);
  }
});
