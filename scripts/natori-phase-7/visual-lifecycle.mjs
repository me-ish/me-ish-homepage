import { createConnection } from 'node:net';
import { readFile } from 'node:fs/promises';

const witnesses = new WeakMap();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fail = code => { throw new Error(code); };
const positivePid = pid => Number.isSafeInteger(pid) && pid > 0;
const exited = child => child.exitCode !== null || child.signalCode !== null;

/** Attach before spawn/exit events can fire. Receipt records observed events only. */
export function trackProcess(child) {
  if (witnesses.has(child)) return witnesses.get(child);
  const witness = { spawnObserved: false, pid: null, exitObserved: false, exitCode: null, signal: null, spawnFailed: false };
  witness.exit = new Promise(resolve => child.once('exit', (code, signal) => {
    witness.exitObserved = true; witness.exitCode = code; witness.signal = signal; resolve();
  }));
  child.once('spawn', () => { witness.spawnObserved = true; witness.pid = child.pid; });
  witness.failure = new Promise(resolve => child.once('error', () => { witness.spawnFailed = true; resolve(); }));
  witnesses.set(child, witness); return witness;
}

function snapshot(witness) {
  return { spawnObserved: witness.spawnObserved, pid: witness.pid, exitObserved: witness.exitObserved,
    exitCode: witness.exitCode, signal: witness.signal, spawnFailed: witness.spawnFailed };
}

async function boundedExit(witness, timeoutMs) {
  if (witness.exitObserved) return;
  let timer;
  try { await Promise.race([witness.exit, witness.failure, new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); })]); }
  finally { clearTimeout(timer); }
}

function connectionState(host, port, timeoutMs) {
  return new Promise(resolve => {
    let settled = false;
    const socket = createConnection({ host, port });
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); socket.destroy(); resolve(value); };
    const timer = setTimeout(() => finish('unknown'), timeoutMs);
    socket.once('connect', () => finish('open'));
    socket.once('error', error => finish(error.code === 'ECONNREFUSED' ? 'closed' : 'unknown'));
  });
}

function portOf(app) {
  const url = new URL(app);
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash) fail('VISUAL_APP_NOT_LOOPBACK');
  const port = Number(url.port || 80);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('VISUAL_PORT_INVALID');
  return port;
}

async function quietPort(port, timeoutMs) {
  const states = [await connectionState('127.0.0.1', port, timeoutMs)];
  return { closed: states.every(state => state === 'closed'), occupied: states.some(state => state === 'open'), states };
}

export async function assertQuietPort({ port, timeoutMs = 500 }) {
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('VISUAL_PORT_INVALID');
  const result = await quietPort(port, timeoutMs);
  if (result.occupied) fail('VISUAL_PORT_OCCUPIED');
  if (!result.closed) fail('VISUAL_PORT_PROBE_UNKNOWN');
  return { freePortBeforeSpawn: true, probeHost: '127.0.0.1', ipv4Refused: true, ipv6Probed: false };
}

async function ownedDescendant(pid, rootPid) {
  if (!positivePid(pid) || !positivePid(rootPid)) return false;
  if (pid === rootPid) return true;
  if (process.platform !== 'linux') return false;
  // Linux Next CLI uses a worker: read only these validated, local PID ancestry records.
  for (let depth = 0; depth < 8; depth++) {
    let stat;
    try { stat = await readFile(`/proc/${pid}/stat`, 'utf8'); } catch { return false; }
    const end = stat.lastIndexOf(')');
    if (end < 0) return false;
    const parentPid = Number(stat.slice(end + 2).split(' ')[1]);
    if (parentPid === rootPid) return true;
    if (!positivePid(parentPid) || parentPid === pid) return false;
    pid = parentPid;
  }
  return false;
}

function readinessDiagnosticCode(error) {
  // Compare only known literals. Never return arbitrary error/cause text.
  try {
    if (error?.cause?.message === 'unexpected redirect') return 'REDIRECT_REJECTED';
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'REQUEST_TIMEOUT';
    if (error?.cause?.code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  } catch { /* Accessors cannot turn diagnostics into a raw error path. */ }
  return 'FETCH_FAILED';
}

export async function waitOwnedReady(child, { app, nonce, timeoutMs = 120000, pollMs = 400, requestTimeoutMs = 2000, onDiagnostic = null }) {
  portOf(app);
  if (!/^[a-f0-9]{64}$/.test(nonce)) fail('VISUAL_OWNER_NONCE_INVALID');
  const witness = witnesses.get(child);
  if (!witness) fail('VISUAL_PROCESS_NOT_TRACKED');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (witness.spawnFailed) fail('VISUAL_SPAWN_FAILED');
    if (exited(child) || witness.exitObserved) fail('VISUAL_EXITED_BEFORE_READY');
    if (witness.spawnObserved && positivePid(witness.pid)) {
      let response, data, code = 'FETCH_FAILED', httpStatus = null;
      try {
        response = await fetch(app + '/api/fixture-visual-owner', { redirect: 'error', signal: AbortSignal.timeout(requestTimeoutMs) });
        httpStatus = Number.isInteger(response.status) && response.status >= 0 && response.status <= 599 ? response.status : null;
        if (response.ok) {
          try { data = await response.json(); code = 'OWNER_JSON_RECEIVED'; }
          catch { code = 'JSON_INVALID'; }
        } else code = 'HTTP_NOT_OK';
      } catch (error) { code = readinessDiagnosticCode(error); }
      if (typeof onDiagnostic === 'function') onDiagnostic({ code, httpStatus });
      // No response, redirect, timeout or malformed JSON establishes ownership.
      if (data) {
        if (data.kind !== 'natori-visual-owner-v1' || data.nonce !== nonce || !positivePid(data.pid)) fail('VISUAL_READY_OWNER_MISMATCH');
        if (!await ownedDescendant(data.pid, witness.pid)) fail('VISUAL_READY_PID_NOT_OWNED');
        if (exited(child) || witness.exitObserved) fail('VISUAL_EXITED_AFTER_READY');
        return { ...snapshot(witness), ownerNonceMatched: true, readyWorkerPid: data.pid, ownedAncestryVerified: true };
      }
    }
    await pause(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
  fail('VISUAL_READY_TIMEOUT');
}

export async function waitProcessExit(child, timeoutMs) {
  const witness = witnesses.get(child);
  if (!witness) fail('VISUAL_PROCESS_NOT_TRACKED');
  await boundedExit(witness, timeoutMs);
  if (witness.spawnFailed) fail('VISUAL_SPAWN_FAILED');
  if (!witness.exitObserved) fail('VISUAL_PROCESS_EXIT_TIMEOUT');
  return snapshot(witness);
}

/** Exit event AND literal IPv4-loopback ECONNREFUSED are required. Timeouts are failure. */
export async function stopOwned(child, { app = null, termTimeoutMs = 5000, killTimeoutMs = 5000, portTimeoutMs = 15000, pollMs = 200 } = {}) {
  const witness = witnesses.get(child);
  if (!witness) fail('VISUAL_PROCESS_NOT_TRACKED');
  let forcedKill = false;
  if (witness.spawnFailed && !witness.spawnObserved) fail('VISUAL_SPAWN_FAILED');
  if (!witness.exitObserved && !exited(child)) {
    child.kill('SIGTERM');
    await boundedExit(witness, termTimeoutMs);
    if (!witness.exitObserved) {
      forcedKill = true; child.kill('SIGKILL');
      await boundedExit(witness, killTimeoutMs);
    }
  }
  if (!witness.exitObserved) fail('VISUAL_PROCESS_DID_NOT_EXIT');
  if (app === null) return { ...snapshot(witness), forcedKill, portClosed: null };
  const port = portOf(app), deadline = Date.now() + portTimeoutMs;
  while (Date.now() < deadline) {
    const result = await quietPort(port, Math.min(500, Math.max(1, deadline - Date.now())));
    if (result.closed) return { ...snapshot(witness), forcedKill, portClosed: true, probeHost: '127.0.0.1', ipv4Refused: true, ipv6Probed: false };
    await pause(Math.min(pollMs, Math.max(1, deadline - Date.now())));
  }
  fail('VISUAL_PORT_NOT_CLOSED');
}
