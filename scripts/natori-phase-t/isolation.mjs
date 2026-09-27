import { readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import dgram from 'node:dgram';
import { spawn } from 'node:child_process';
import { guardedFetch } from './guard.mjs';
const { origin } = JSON.parse(readFileSync('/runtime/network.json'));
const results = [];
const check = (ok) => { if (!ok) throw new Error('ISOLATION_ASSERTION_FAILED'); };
async function test(name, fn) {
  try { await fn(); results.push({ name, status: 'passed' }); console.log(`PASS isolation/${name}`); }
  catch { results.push({ name, status: 'failed' }); console.log(`FAIL isolation/${name}`); }
}
for (const endpoint of [
  'https://production-example.supabase.co', 'https://api.stripe.com', 'https://api.resend.com',
  'postgresql://postgres@production-example.supabase.co/postgres',
  'http://127.0.0.1:55431', `${origin}/`, `${origin}@example.invalid`, `${origin}?url=bad`,
]) {
  await test(`preflight-reject-${results.length + 1}`, async () => {
    let calls = 0, rejected = false;
    try { const request = guardedFetch(endpoint, origin, async () => { calls++; }); await request('/'); }
    catch (e) { rejected = e.message === 'PHASE_T_DESTINATION_REJECTED'; }
    check(rejected && calls === 0);
  });
}
await test('preflight-allow-exact-origin', async () => {
  let calls = 0;
  await guardedFetch(origin, origin, async () => { calls++; })('/auth/v1/health');
  check(calls === 1);
});
await test('allowed-api-reachable', async () => {
  const r = await guardedFetch(origin, origin)('/auth/v1/health');
  check(r.ok);
});
function blocked(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const timeout = setTimeout(() => { socket.destroy(); resolve(); }, 800);
    socket.once('connect', () => { clearTimeout(timeout); socket.destroy(); reject(new Error('CONNECTED')); });
    socket.once('error', () => { clearTimeout(timeout); resolve(); });
  });
}
await test('kernel-ipv4-external-block', () => blocked('198.51.100.10', 443));
await test('kernel-host-gateway-block', () => blocked('172.30.250.1', 55431));
await test('kernel-api-wrong-port-block', () => blocked(new URL(origin).hostname, 8001));
await test('kernel-ipv6-block', () => blocked('2001:db8::1', 443));
await test('kernel-loopback-listener-block', async () => {
  const server = net.createServer(s => s.destroy());
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(18081, '127.0.0.1', resolve); });
  try { await blocked('127.0.0.1', 18081); } finally { server.close(); }
});
await test('kernel-dns-block', async () => {
  const s = dgram.createSocket('udp4');
  // A real DNS query to Docker's resolver must not leave the test namespace.
  const query = Buffer.from('abcd01000001000000000000076578616d706c6503636f6d0000010001', 'hex');
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 800);
      s.once('message', () => { clearTimeout(timer); reject(new Error('DNS_RESPONSE')); });
      s.once('error', () => { clearTimeout(timer); resolve(); });
      s.send(query, 53, '127.0.0.11');
    });
  } finally { s.close(); }
});
await test('child-process-inherits-kernel-block', async () => {
  const code = `const net=require('node:net');const s=net.connect(443,'198.51.100.10');s.on('connect',()=>process.exit(1));s.on('error',()=>process.exit(0));setTimeout(()=>process.exit(0),800);`;
  const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore', env: {} });
  const status = await new Promise((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  check(status === 0);
});
const summary = { passed: results.filter(r => r.status === 'passed').length, failed: results.filter(r => r.status === 'failed').length, skipped: 0, results };
writeFileSync('/results/isolation.json', JSON.stringify(summary, null, 2));
console.log(`SUMMARY isolation: passed=${summary.passed} failed=${summary.failed} skipped=0`);
if (summary.failed) process.exitCode = 1;
