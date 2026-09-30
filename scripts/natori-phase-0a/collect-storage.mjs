import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const codes = new Set(['ENOENT', 'ENODATA', 'EIO', 'EACCES', 'ECONNRESET',
  'ETIMEDOUT', 'InternalError', 'NoSuchKey', 'S3Error', 'DatabaseError',
  'ResourceAlreadyExists', 'KeyAlreadyExists', 'ResourceLocked', 'LockTimeout',
  'AccessDenied', 'InvalidJWT', '23505', '40P01', '40001']);
const locations = ['FileBackend.getObject', 'FileBackend.headObject',
  'FileBackend.getMetadataAttr', 'FileBackend.getFileMetadata',
  'ObjectAdminDelete.handle', 'Uploader.completeUpload'];
const fingerprint = (value) => typeof value === 'string' && value
  ? createHash('md5').update(value).digest('hex').slice(0, 16) : undefined;
const objectPattern = /entry_[0-9a-f-]{36}\.(?:png|jpg)/;
const versionPattern = /entry_[0-9a-f-]{36}\.(?:png|jpg)(?:\/|-\$v-)([0-9a-f-]{36})/;

// Emit an allowlist-built record, never a redacted copy of a raw log. Raw
// messages, URLs, headers, payloads and stack traces cannot reach the artifact.
export function classify(line) {
  let log;
  try { log = JSON.parse(line); } catch { return null; }
  if (!log || typeof log !== 'object') return null;
  const req = log.req ?? {}, res = log.res ?? {};
  const path = typeof req.url === 'string' ? req.url.split('?', 1)[0] : '';
  const object = path.match(objectPattern)?.[0] ??
    String(log.objectPath ?? '').match(objectPattern)?.[0];
  const errors = new Set(), frames = new Set(), versions = new Set();
  const walk = (error, depth = 0) => {
    if (!error || typeof error !== 'object' || depth > 6) return;
    for (const key of ['code', 'errorCode', 'name'])
      if (codes.has(error[key])) errors.add(error[key]);
    for (const key of ['message', 'stack', 'path']) {
      const value = typeof error[key] === 'string' ? error[key] : '';
      for (const code of codes) if (value.includes(code)) errors.add(code);
      for (const frame of locations) if (value.includes(frame)) frames.add(frame);
      const version = value.match(versionPattern)?.[1];
      if (version) versions.add(fingerprint(version));
    }
    for (const key of ['originalError', 'cause']) walk(error[key], depth + 1);
    if (typeof error.raw === 'string') {
      try { walk(JSON.parse(error.raw), depth + 1); } catch { /* No raw fallback. */ }
    }
  };
  walk(log.error);
  let payload;
  try { payload = JSON.parse(log.payload ?? 'null'); } catch { /* No raw fallback. */ }
  const deleted = log.event === 'ObjectAdminDelete';
  const published = path.includes('/artworks/') ||
    String(log.objectPath ?? '').includes('/artworks/');
  if (!object && errors.size === 0 && !deleted) return null;
  const record = {
    time: Number.isSafeInteger(log.time) ? log.time : undefined,
    request: fingerprint(log.reqId),
    object: fingerprint(object ?? payload?.name?.match?.(objectPattern)?.[0]),
    area: published ? 'published' : 'other',
    operation: deleted ? 'version-delete' : path.includes('/object/info/') ? 'info'
      : req.method === 'POST' ? 'upload' : req.method === 'GET' ? 'download' : 'other',
    status: Number.isInteger(res.statusCode) && res.statusCode >= 100 && res.statusCode <= 599
      ? res.statusCode : undefined,
    upsert: req.headers?.x_upsert === 'false' ? false
      : req.headers?.x_upsert === 'true' ? true : undefined,
    errors: [...errors].sort(),
    locations: [...frames].sort(),
    missingVersions: [...versions].sort(),
    deletedVersion: deleted ? fingerprint(payload?.version ?? log.objectVersion) : undefined,
  };
  return record;
}

function main() {
  const [project, output] = process.argv.slice(2);
  if (process.env.GITHUB_ACTIONS !== 'true' ||
    !/^natori-phase-t-\d+-\d+$/.test(project ?? '') || !output)
    throw new Error('DIAGNOSTIC_GUARD');
  const container = `supabase_storage_${project}`;
  const inspect = spawnSync('docker', ['inspect', '-f',
    '{{index .Config.Labels "com.supabase.cli.project"}}', container], {encoding: 'utf8'});
  if (inspect.status !== 0 || inspect.stdout.trim() !== project)
    throw new Error('DIAGNOSTIC_CONTAINER_GUARD');
  const backend = spawnSync('docker', ['exec', container, 'printenv', 'STORAGE_BACKEND'], {encoding: 'utf8'});
  const logs = spawnSync('docker', ['logs', container], {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  if (logs.status !== 0) throw new Error('DIAGNOSTIC_LOGS_FAILED');
  const records = `${logs.stdout}\n${logs.stderr}`.split('\n').map(classify).filter(Boolean)
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  if (records.length > 10000) throw new Error('DIAGNOSTIC_LIMIT');
  const summary = { backend: ['file', 's3'].includes(backend.stdout?.trim())
    ? backend.stdout.trim() : 'unclassified', records };
  const controls = ['race-baseline', 'race-recovery'];
  const proof = {};
  for (const mode of controls) {
    const path = `${output}/phase0a-${mode}.json`;
    if (!existsSync(path)) continue;
    const trace = JSON.parse(readFileSync(path, 'utf8'));
    const failed = trace.events.find(e => e.operation === 'published-download' && e.status === 500);
    const internal = failed && records.find(r => r.object === failed.object && r.status === 500
      && r.time >= failed.startedEpochMs && r.errors.includes('ENOENT') && r.missingVersions.length);
    if (!internal || !records.some(r => r.operation === 'version-delete' && r.object === internal.object
      && r.time <= internal.time && internal.missingVersions.includes(r.deletedVersion)))
      throw new Error('CONTROLLED_MISSING_VERSION_NOT_PROVEN');
    proof[mode] = {missingOldVersionMatched: true};
  }
  summary.controlledCause = proof;
  writeFileSync(`${output}/phase0a-storage.json`, JSON.stringify(summary, null, 2), {mode: 0o600});
  console.log(`Storage internal classifications saved: records=${records.length}, errors=${records.filter(r => r.errors.length).length}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch {
    console.error('STORAGE_DIAGNOSTIC_CAPTURE_FAILED; raw logs withheld');
    process.exitCode = 1;
  }
}
