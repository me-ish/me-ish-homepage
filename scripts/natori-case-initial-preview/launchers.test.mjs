import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { privateLaunchers } from './launchers.mjs';
const bytes = Buffer.from('synthetic source archive'), sha = createHash('sha256').update(bytes).digest('hex');
function execute(source, { platform = true, node = '22.23.4', failStep, data = bytes } = {}) {
  const effects = [], context = { Buffer, console: { log() {}, error() {} },
    process: { execPath: '/synthetic/node', versions: { node }, exit(code) { effects.push(['exit', code]); throw Error('exit'); } },
    require(name) {
      if (name === 'node:child_process') return { spawnSync(cmd, args) {
        effects.push([cmd, args]);
        return { status: args[0] === 'preview-platform-gate.mjs' && !platform || args[0] === failStep ? 1 : 0 };
      } };
      if (name === 'node:crypto') return { createHash };
      if (name === 'node:fs') return {
        readdirSync() { effects.push(['list-parts']); return ['application-source.part-000']; },
        readFileSync() { return data; },
        writeFileSync() { effects.push(['write-archive']); },
      };
      throw Error('unexpected dependency');
    },
  };
  try { vm.runInNewContext(source, context); } catch (error) { if (error.message !== 'exit') throw error; }
  return effects;
}
test('both private launchers stop at the platform gate before filesystem/setup/npm effects', () => {
  for (const source of Object.values(privateLaunchers(sha, 1))) {
    assert.equal(JSON.stringify(execute(source, { platform: false })), JSON.stringify([
      ['/synthetic/node', ['preview-platform-gate.mjs']], ['exit', 1],
    ]));
  }
});
test('both private launchers stop a wrong hosted Node version before filesystem or setup', () => {
  for (const source of Object.values(privateLaunchers(sha, 1))) {
    const effects = execute(source, { node: '24.19.0' });
    assert.equal(effects.length, 2); assert.equal(effects[1][0], 'exit');
  }
});
test('install checks all source bytes before extraction or npm, and rejects mismatching content', () => {
  const source = privateLaunchers(sha, 1)['preview-install.cjs'];
  const effects = execute(source);
  assert.equal(JSON.stringify(effects.map(e => e[0])), JSON.stringify(['/synthetic/node', 'list-parts', 'write-archive', 'tar', 'npm']));
  assert.throws(() => execute(source, { data: Buffer.from('different') }), /source_unconfirmed/);
});
test('build setup follows both gates; a setup failure prevents Next build', () => {
  const source = privateLaunchers(sha, 1)['preview-build.cjs'];
  assert.equal(execute(source).length, 3);
  const effects = execute(source, { failStep: 'scripts/natori-case-initial-preview/setup.mjs' });
  assert(!effects.some(e => e[0] === 'npm')); assert.equal(effects.at(-1)[0], 'exit');
});
test('launchers accept only pinned digests and bounded part counts', () => {
  assert.throws(() => privateLaunchers('arbitrary', 1)); assert.throws(() => privateLaunchers(sha, 0));
});
