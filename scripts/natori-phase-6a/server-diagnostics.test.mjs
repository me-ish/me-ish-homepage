import test from 'node:test';
import assert from 'node:assert/strict';
import { createServerDiagnostics } from './server-diagnostics.mjs';

test('split output preserves errors and classifies a manifest JSON failure', () => {
  const d = createServerDiagnostics({ getCaseIndex: () => 0 });
  d.write('stderr', Buffer.from('SyntaxErr'));
  d.write('stderr', Buffer.from('or: Unexpected end of JSON input\n    at JSON.parse (<anonymous>)\n'));
  d.write('stderr', Buffer.from('    at loadManifest (/app/node_modules/next/dist/server/load-manifest.external.js:43:25)\n'));
  assert.deepEqual(d.flush(), { codes: ['SyntaxError'], events: [{ stream: 'stderr', caseIndex: 0,
    codes: ['SyntaxError'], markers: ['json_truncated', 'json_parse', 'next_manifest'] }], omitted: 0 });
});

test('diagnostics emit only fixed classifications, never hostile output or secrets', () => {
  const updates = [], secret = 'private-value@example.invalid?token=TOP_SECRET';
  const d = createServerDiagnostics({ getCaseIndex: () => secret, onUpdate: item => updates.push(item) });
  d.write('stdout', Buffer.from(`SyntaxError: Unexpected token '${secret}'\n    at ${secret}\n`));
  d.write('stderr', Buffer.from(`Module not found: ${secret}\nFailed to compile\nEADDRINUSE ${secret}`));
  const result = d.flush(), serialized = JSON.stringify([result, updates]);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('TOP_SECRET'), false);
  assert.deepEqual(result.codes, ['SyntaxError', 'Module not found', 'Failed to compile', 'EADDRINUSE']);
  assert.ok(result.events.every(event => event.caseIndex === 0));
});

test('stdout and stderr fragments cannot invent or erase an error', () => {
  const d = createServerDiagnostics({ getCaseIndex: () => 2 });
  d.write('stdout', Buffer.from('Syntax'));
  d.write('stderr', Buffer.from('Error\n'));
  d.write('stdout', Buffer.from('Error\n'));
  assert.deepEqual(d.flush().codes, ['SyntaxError']);
  assert.equal(d.snapshot().events[0].caseIndex, 2);
});

test('diagnostic limits bound noise while preserving the failing gate', () => {
  const d = createServerDiagnostics({ getCaseIndex: () => 1 });
  d.write('stderr', Buffer.from('x'.repeat(16380) + 'SyntaxError\n'));
  d.write('stderr', Buffer.from('SyntaxError\n'.repeat(50)));
  const result = d.flush();
  assert.ok(d.codes.has('SyntaxError'));
  assert.equal(result.events.length, 32);
  assert.equal(result.omitted, 19);
});
