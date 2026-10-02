// Both modes own a fresh sealed Next server; neither relies on an earlier phase's
// process. Mode 6b does not generate or evaluate any Phase 7 surface.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { setDefaultResultOrder } from 'node:dns';
import { lookup } from 'node:dns/promises';
let mode = null, assertQuietPort, trackProcess, waitOwnedReady, waitOwnedSessionReady, waitProcessExit, stopOwned;
const check = (value, code) => { if (!value) throw new Error(code); };
let server, child, stage = 'preflight', browserExit = null, fontEvidence, portControls = null, hostnameResolution = null; const compileErrors = new Set();
const lifecycle = { freePort: null, ready: null, browserExit: null, browserClosed: null, serverClosed: null };
const listener = Object.freeze({ configuredHost: 'localhost', ownerProbeHost: '127.0.0.1', probeHost: '127.0.0.1', browserOrigin: 'http://localhost:3000', dnsResultOrder: 'ipv4first', ipv6Probed: false });
const failures = [];
const readinessDiagnostics = { attempts: 0, first: null, last: null, counts: {} };
const readinessDiagnosticCodes = new Set(['OWNER_JSON_RECEIVED', 'HTTP_NOT_OK', 'JSON_INVALID', 'REDIRECT_REJECTED', 'REQUEST_TIMEOUT', 'CONNECTION_REFUSED', 'FETCH_FAILED']);
function recordReadinessDiagnostic(value) {
  check(readinessDiagnosticCodes.has(value.code) && (value.httpStatus === null
    || Number.isInteger(value.httpStatus) && value.httpStatus >= 0 && value.httpStatus <= 599), 'VISUAL_SETUP_FAILED');
  const entry = { code: value.code, httpStatus: value.httpStatus };
  readinessDiagnostics.attempts++;
  if (readinessDiagnostics.first === null) readinessDiagnostics.first = entry;
  readinessDiagnostics.last = entry;
  readinessDiagnostics.counts[value.code] = (readinessDiagnostics.counts[value.code] ?? 0) + 1;
}

const sessionReadiness = { path: '/fixture-session', acceptLanguage: 'ja', sharedStartupDeadline: true,
  startupLimitMs: 120000, requestTimeoutMs: 2000, elapsedMs: null, formMarkerMatched: false, ownerRevalidated: false,
  attempts: 0, first: null, last: null, counts: {} };
const sessionDiagnosticCodes = new Set(['SESSION_FORM_RECEIVED', 'HTTP_NOT_OK', 'FORM_INVALID', 'REDIRECT_REJECTED', 'REQUEST_TIMEOUT', 'CONNECTION_REFUSED', 'FETCH_FAILED']);
function recordSessionDiagnostic(value) {
  check(sessionDiagnosticCodes.has(value.code) && (value.httpStatus === null
    || Number.isInteger(value.httpStatus) && value.httpStatus >= 0 && value.httpStatus <= 599), 'VISUAL_SETUP_FAILED');
  const entry = { code: value.code, httpStatus: value.httpStatus };
  sessionReadiness.attempts++;
  if (sessionReadiness.first === null) sessionReadiness.first = entry;
  sessionReadiness.last = entry;
  sessionReadiness.counts[value.code] = (sessionReadiness.counts[value.code] ?? 0) + 1;
}

const ownerRoute = `export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  const nonce = process.env.PHASE_7_VISUAL_OWNER_NONCE;
  if (process.env.PHASE_N_BROWSER !== 'ephemeral' || process.env.PHASE_6B_BROWSER !== 'ephemeral' || !/^[a-f0-9]{64}$/.test(nonce ?? '')) return new Response(null, { status: 404 });
  return Response.json({ kind: 'natori-visual-owner-v1', nonce, pid: process.pid });
}
`;
const ownerRouteSha256 = createHash('sha256').update(ownerRoute).digest('hex');
const knownCodes = new Set(["ACCEPTED_FIXTURE", "AUTH_FIXTURE", "CONTENT_FIXTURE", "DESTINATION_REJECTED", "DRAFT_FIXTURE", "EPHEMERAL_REQUIRED", "LINK_FIXTURE", "NEXT_READY", "PINNED_OFFLINE_FONTS_REQUIRED", "PROJECT_FIXTURE", "QUOTE_FIXTURE", "TASK_FIXTURE", "UNKNOWN_FAILURE", "VISUAL_APP_NOT_LOOPBACK", "VISUAL_BROWSER_FAILED", "VISUAL_BROWSER_STOP_FAILED", "VISUAL_CHILD_OUTPUT_FAILED", "VISUAL_EXITED_AFTER_READY", "VISUAL_EXITED_BEFORE_READY", "VISUAL_MODE_REQUIRED", "VISUAL_OWNERSHIP_UNPROVEN", "VISUAL_OWNER_NONCE_INVALID", "VISUAL_OWNER_ROUTE_DRIFT", "VISUAL_PORT_CONTROL_FAILED", "VISUAL_PORT_INVALID", "VISUAL_PORT_NOT_CLOSED", "VISUAL_PORT_OCCUPIED", "VISUAL_PORT_PROBE_UNKNOWN", "VISUAL_PROCESS_DID_NOT_EXIT", "VISUAL_PROCESS_EXIT_TIMEOUT", "VISUAL_PROCESS_NOT_TRACKED", "VISUAL_READY_OWNER_MISMATCH", "VISUAL_READY_PID_NOT_OWNED", "VISUAL_READY_TIMEOUT", "VISUAL_READY_DEADLINE_INVALID", "VISUAL_HOSTNAME_NOT_IPV4_LOOPBACK", "VISUAL_SESSION_READY_TIMEOUT", "VISUAL_SESSION_HTTP_NOT_OK", "VISUAL_SESSION_FORM_INVALID", "VISUAL_SESSION_REDIRECT_REJECTED", "VISUAL_SESSION_FETCH_FAILED", "VISUAL_RESULT_WRITE_FAILED", "VISUAL_SERVER_OUTPUT_FAILED", "VISUAL_SERVER_STOP_FAILED", "VISUAL_SETUP_FAILED", "VISUAL_SPAWN_FAILED"]);
function diagnosticMessage(error) {
  try { const message = error?.message; return typeof message === 'string' ? message : ''; }
  catch { return ''; }
}
function safeFailure(error, fallback) {
  const message = diagnosticMessage(error);
  return knownCodes.has(message) ? message : knownCodes.has(fallback) ? fallback : 'UNKNOWN_FAILURE';
}

async function main() {
  check(process.argv.length === 3 && ['6b', '7'].includes(process.argv[2]), 'VISUAL_MODE_REQUIRED');
  mode = process.argv[2];
  check(process.env.PHASE_N_BROWSER === 'ephemeral', 'EPHEMERAL_REQUIRED');
  setDefaultResultOrder('ipv4first');
  const resolvedHostname = await lookup(listener.configuredHost);
  check(resolvedHostname.address === listener.ownerProbeHost && resolvedHostname.family === 4, 'VISUAL_HOSTNAME_NOT_IPV4_LOOPBACK');
  hostnameResolution = { address: resolvedHostname.address, family: resolvedHostname.family };
  ({ assertQuietPort, trackProcess, waitOwnedReady, waitOwnedSessionReady, waitProcessExit, stopOwned } = await import('./visual-lifecycle.mjs'));
  const { origin } = JSON.parse(readFileSync('/runtime/network.json', 'utf8'));
  check(/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin), 'DESTINATION_REJECTED');
  const keys = JSON.parse(readFileSync('/runtime/credentials.json', 'utf8'));
  const source = JSON.parse(readFileSync('/app/source-checksums.json', 'utf8'));
  check(source.phase7Fonts?.productFontSourceUnchanged === true, 'PINNED_OFFLINE_FONTS_REQUIRED');
  const app = listener.browserOrigin; let fixture;
  fontEvidence = source.phase7Fonts;
  lifecycle.freePort = await assertQuietPort({ port: 3000 });
  stage = 'port-controls';
  const { runIPv4PortControls } = await import('./ipv4-port-controls.mjs');
  portControls = await runIPv4PortControls();
  stage = 'preflight';
  const routeDirectory = '/app/src/app/api/fixture-visual-owner';
  const routeFile = routeDirectory + '/route.ts';
  if (existsSync(routeFile)) check(readFileSync(routeFile, 'utf8') === ownerRoute, 'VISUAL_OWNER_ROUTE_DRIFT');
  else { mkdirSync(routeDirectory, { recursive: true }); writeFileSync(routeFile, ownerRoute); }
  const ownerNonce = randomBytes(32).toString('hex');
  if (mode === '7') { stage = 'synthetic-fixtures'; const { seedPhase7 } = await import('./seed-fixtures.mjs'); fixture = await seedPhase7(origin, keys); }
  const env = { PATH: '/runtime-bin:/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', TMPDIR: '/tmp', NODE_ENV: 'development',
    NEXT_TELEMETRY_DISABLED: '1', NODE_OPTIONS: '--dns-result-order=ipv4first', PHASE_N_BROWSER: 'ephemeral', PHASE_0B_BROWSER: 'ephemeral',
    PHASE_7_VISUAL_OWNER_NONCE: ownerNonce,
    PHASE_6B_BROWSER: 'ephemeral', ...(mode === '7' ? { PHASE_7_BROWSER: 'ephemeral', PHASE_7_ESTIMATE_PROJECT_ID: fixture.estimateId,
      PHASE_7_MANAGEMENT_PROJECT_ID: fixture.managementId } : {}),
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES: '/app/phase7-font-responses.cjs',
    NEXT_PUBLIC_SUPABASE_URL: origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anon, SUPABASE_SERVICE_ROLE_KEY: keys.service,
    ...(fixture ? { NATORI_OWNER_USER_ID: fixture.owner, NATORI_OWNER_EMAILS: fixture.email } : {}),
    NEXT_PUBLIC_SITE_URL: app, NATORI_DASHBOARD_KEY: randomBytes(32).toString('hex'), NATORI_PUBLIC_INTAKE_V2: '1',
    NATORI_QUOTE_INTEGRITY_ENABLED: '1', NATORI_PAYMENT_INTEGRITY_ENABLED: '1', NATORI_PAYMENT_LINK_INTEGRITY_ENABLED: '1',
    NATORI_REFUND_LEDGER_ENABLED: '0', NATORI_REFUND_LEDGER_READ_ENABLED: '0', NATORI_STRIPE_MODE: 'test',
    STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', RESEND_API_KEY: '', ADMIN_API_TOKEN: '',
    NATORI_ACCEPTANCE_OUTBOX_ENABLED: '1', NATORI_NOTIFICATION_SENDING_ENABLED: '0', NATORI_MAIL_BCC: '',
  };
  stage = 'next-server';
  const startupStartedAt = Date.now(), startupDeadline = startupStartedAt + sessionReadiness.startupLimitMs;
  server = spawn(process.execPath, ['/app/node_modules/next/dist/bin/next', 'dev', '--hostname', 'localhost', '--port', '3000'], { cwd: '/app', env, stdio: ['ignore', 'pipe', 'pipe'] });
  trackProcess(server);
  for (const stream of [server.stdout, server.stderr]) stream.on('error', () => { failures.push({ stage: 'server-output', code: 'VISUAL_SERVER_OUTPUT_FAILED' }); process.exitCode = 1; });
  for (const stream of [server.stdout, server.stderr]) stream.on('data', buffer => {
    const text = buffer.toString();
    for (const code of ['Module not found', 'Failed to compile', 'SyntaxError', 'EADDRINUSE', 'Missing mocked response']) if (text.includes(code)) compileErrors.add(code);
  });
  try {
    lifecycle.ready = await waitOwnedReady(server, { app, nonce: ownerNonce, deadlineMs: startupDeadline, onDiagnostic: recordReadinessDiagnostic });
    stage = 'session-ready';
    const ready = await waitOwnedSessionReady(server, { app, nonce: ownerNonce, deadlineMs: startupDeadline,
      requestTimeoutMs: sessionReadiness.requestTimeoutMs, onDiagnostic: recordSessionDiagnostic, onOwnerDiagnostic: recordReadinessDiagnostic });
    lifecycle.ready = ready.owner;
    sessionReadiness.formMarkerMatched = ready.formMarkerMatched; sessionReadiness.ownerRevalidated = ready.ownerRevalidated;
  } finally { sessionReadiness.elapsedMs = Math.max(0, Date.now() - startupStartedAt); }
  stage = 'visual-browser';
  child = spawn(process.execPath, [mode === '6b' ? '/phase6b-browser/browser.mjs' : '/phase7-browser/browser.mjs'], {
    cwd: '/app', env: { PATH: env.PATH, HOME: '/tmp', TMPDIR: '/tmp', NODE_OPTIONS: env.NODE_OPTIONS, PLAYWRIGHT_BROWSERS_PATH: '/ms-playwright', PHASE_N_BROWSER: 'ephemeral',
      PHASE_6B_BROWSER: 'ephemeral', PHASE_6B_APP_URL: app, PHASE_6B_RESULTS: '/results/phase6b-visual',
      ...(mode === '7' ? { PHASE_7_BROWSER: 'ephemeral', PHASE_7_FIXTURE_STATE: JSON.stringify(fixture) } : {}) }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Child diagnostics are consumed from pinned JSON reports, never replayed as raw output.
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', () => {});
    stream.on('error', () => { failures.push({ stage: 'child-output', code: 'VISUAL_CHILD_OUTPUT_FAILED' }); process.exitCode = 1; });
  }
  trackProcess(child);
  lifecycle.browserExit = await waitProcessExit(child, 540000);
  browserExit = lifecycle.browserExit.exitCode;
  check(browserExit === 0 && lifecycle.browserExit.signal === null && compileErrors.size === 0 && failures.length === 0, 'VISUAL_BROWSER_FAILED');
}
main().catch(error => {
  const code = safeFailure(error, 'VISUAL_SETUP_FAILED'); failures.push({ stage, code });
  console.error(`Phase ${mode === '6b' ? '6B' : mode === '7' ? '7' : 'preflight'} visual failed at ${stage}: ${code}; raw logs withheld`); process.exitCode = 1;
}).finally(async () => {
  // Never report success before observing both owned processes and the port closing.
  if (child) {
    try { lifecycle.browserClosed = await stopOwned(child); }
    catch (error) { failures.push({ stage: 'browser-stop', code: safeFailure(error, 'VISUAL_BROWSER_STOP_FAILED') }); process.exitCode = 1; }
  }
  if (server) {
    try { lifecycle.serverClosed = await stopOwned(server, { app: 'http://localhost:3000' }); }
    catch (error) { failures.push({ stage: 'server-stop', code: safeFailure(error, 'VISUAL_SERVER_STOP_FAILED') }); process.exitCode = 1; }
  }
  const ownServer = hostnameResolution?.address === listener.ownerProbeHost && hostnameResolution?.family === 4
    && portControls?.status === 'passed' && portControls?.cleanup?.exitObserved === true && portControls?.cleanup?.portClosed === true
    && lifecycle.freePort?.freePortBeforeSpawn === true && lifecycle.freePort?.probeHost === listener.probeHost
    && lifecycle.freePort?.ipv4Refused === true && lifecycle.freePort?.ipv6Probed === false && lifecycle.ready?.ownerNonceMatched === true
    && lifecycle.ready?.ownedAncestryVerified === true && lifecycle.serverClosed?.exitObserved === true && lifecycle.serverClosed?.portClosed === true
    && lifecycle.serverClosed?.probeHost === listener.probeHost && lifecycle.serverClosed?.ipv4Refused === true && lifecycle.serverClosed?.ipv6Probed === false;
  if (!ownServer && failures.length === 0) { failures.push({ stage: 'lifecycle', code: 'VISUAL_OWNERSHIP_UNPROVEN' }); process.exitCode = 1; }
  try {
    writeFileSync(mode === '6b' ? '/results/phase6b-visual-server.json' : mode === '7' ? '/results/phase7-visual-server.json' : '/results/phase-visual-preflight.json', JSON.stringify({ mode, status: failures.length === 0 ? 'passed' : 'failed', browserExit, compileErrors: [...compileErrors],
      ownServer, listener, hostnameResolution, lifecycle, portControls, readinessDiagnostics, sessionReadiness, failures, syntheticOwnerRouteSha256: ownerRouteSha256, sendingEnabled: false, providerCallsConfigured: false, fonts: fontEvidence,
      interpretation: mode === '6b' ? 'Phase 6B browser only; no Phase 7 adoption or screen acceptance' : 'Phase 7 synthetic isolated screen evidence; human evaluation remains distinct' }, null, 2));
  } catch { console.error('VISUAL_RESULT_WRITE_FAILED; raw logs withheld'); process.exitCode = 1; }
});
