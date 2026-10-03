// Runs only inside the already sealed visual runtime. No firewall rules change.
// Port 3000 is the existing allowed IPv4 application port; 3001 remains blocked.
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { assertQuietPort, trackProcess, waitOwnedReady, stopOwned } from './visual-lifecycle.mjs';

const fail = () => { throw new Error('VISUAL_PORT_CONTROL_FAILED'); };
const ownerSource = `
const http = require('node:http');
const nonce = process.argv[1];
if (!/^[a-f0-9]{64}$/.test(nonce ?? '')) process.exit(1);
const server = http.createServer((request, response) => {
  if (request.url !== '/api/fixture-visual-owner') { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify({ kind: 'natori-visual-owner-v1', nonce, pid: process.pid }));
});
server.on('error', () => process.exit(1));
server.listen(3000, '127.0.0.1');
process.on('SIGTERM', () => { server.close(() => process.exit(0)); server.closeAllConnections(); });
`;

async function blockedTimeout() {
  const timeoutMs = 500, start = performance.now();
  return new Promise((resolve, reject) => {
    let settled = false;
    const socket = createConnection({ host: '127.0.0.1', port: 3001 });
    const finish = timeoutObserved => {
      if (settled) return;
      settled = true; clearTimeout(timer); socket.destroy();
      if (!timeoutObserved) { reject(new Error('VISUAL_PORT_CONTROL_FAILED')); return; }
      resolve({ timeoutObserved: true, timeoutMs, elapsedMs: Math.ceil(performance.now() - start) });
    };
    const timer = setTimeout(() => finish(true), timeoutMs);
    socket.once('connect', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function rejection(operation, expected) {
  try { await operation(); }
  catch (error) {
    if (error instanceof Error && error.message === expected) return { rejected: true, code: expected };
    fail();
  }
  fail();
}

export async function runIPv4PortControls() {
  if (process.env.PHASE_N_BROWSER !== 'ephemeral') fail();
  const freePort = await assertQuietPort({ port: 3000, timeoutMs: 500 });
  const nonce = randomBytes(32).toString('hex');
  let child, ready, occupied, blocked, cleanup;
  try {
    child = spawn(process.execPath, ['-e', ownerSource, nonce], {
      cwd: '/tmp', env: { PATH: '/runtime-bin:/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', TMPDIR: '/tmp', NODE_OPTIONS: '--dns-result-order=ipv4first' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    trackProcess(child);
    // Drain controlled child output without replaying any raw bytes.
    for (const stream of [child.stdout, child.stderr]) { stream.on('data', () => {}); stream.on('error', () => {}); }
    ready = await waitOwnedReady(child, { app: 'http://127.0.0.1:3000', nonce, timeoutMs: 15000, pollMs: 50, requestTimeoutMs: 500 });
    occupied = { port: 3000, ...await rejection(() => assertQuietPort({ port: 3000, timeoutMs: 500 }), 'VISUAL_PORT_OCCUPIED') };
    const timeout = await blockedTimeout();
    blocked = { port: 3001, ...timeout, ...await rejection(() => assertQuietPort({ port: 3001, timeoutMs: 500 }), 'VISUAL_PORT_PROBE_UNKNOWN') };
  } finally {
    if (child) cleanup = await stopOwned(child, { app: 'http://127.0.0.1:3000', termTimeoutMs: 5000, killTimeoutMs: 5000, portTimeoutMs: 5000, pollMs: 50 });
  }
  if (ready?.ownerNonceMatched !== true || ready?.ownedAncestryVerified !== true || cleanup?.exitObserved !== true
      || cleanup?.portClosed !== true || cleanup?.probeHost !== '127.0.0.1' || cleanup?.ipv4Refused !== true || cleanup?.ipv6Probed !== false) fail();
  return { status: 'passed', host: '127.0.0.1', freePort, ready, occupied, blocked, cleanup };
}
