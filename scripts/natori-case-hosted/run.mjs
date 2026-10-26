import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describePlan, HostedAcceptanceError, requireCheck, validateDeploymentEvidence, validatePlan } from './config.mjs';
import { runHostedReadOnly } from './runner.mjs';

export function parseArguments(args) {
  if (args.length === 0 || args[0] === '--help') return { mode: 'help' };
  const mode = args[0];
  requireCheck(['plan', 'execute-read-only'].includes(mode), 'arguments_invalid');
  const values = {};
  for (let i = 1; i < args.length; i += 2) {
    requireCheck(['--config', '--approved-sha256', '--deployment-evidence', '--out'].includes(args[i])
      && typeof args[i + 1] === 'string' && !args[i + 1].startsWith('--') && !(args[i] in values), 'arguments_invalid');
    values[args[i]] = args[i + 1];
  }
  requireCheck(Boolean(values['--config']), 'arguments_invalid');
  requireCheck(!/^\.env(?:\.|$)/.test(basename(values['--config'])), 'environment_file_forbidden');
  if (mode === 'plan') requireCheck(Object.keys(values).length === 1, 'arguments_invalid');
  else requireCheck(Boolean(values['--out']) && Boolean(values['--deployment-evidence']) && /^[a-f0-9]{64}$/.test(values['--approved-sha256'] ?? ''), 'approval_required');
  return { mode, config: values['--config'], digest: values['--approved-sha256'], evidence: values['--deployment-evidence'], out: values['--out'] };
}
async function readNonsecretJson(file) {
  const { lstat } = await import('node:fs/promises');
  const absolute = resolve(file);
  requireCheck((absolute.startsWith('/workspace/') || absolute.startsWith('/tmp/'))
    && absolute.endsWith('.json') && !absolute.split('/').some(v => /^\.env(?:\.|$)/i.test(v)), 'nonsecret_json_required');
  const stat = await lstat(absolute);
  requireCheck(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 32768, 'nonsecret_json_required');
  return readFile(absolute, 'utf8');
}
export async function main(args, dependencies = {}) {
  const options = parseArguments(args);
  if (options.mode === 'help') return { help: 'plan --config <nonsecret.json> (no network); execute-read-only --config <nonsecret.json> --approved-sha256 <reviewed digest> --deployment-evidence <recent nonsecret.json> --out <new /workspace or /tmp directory>. External execution needs separate explicit authorization.' };
  const read = dependencies.readFile ?? readNonsecretJson;
  const text = await read(options.config, 'utf8');
  requireCheck(Buffer.byteLength(text) <= 32768, 'plan_too_large');
  let input; try { input = JSON.parse(text); } catch { throw new HostedAcceptanceError('plan_invalid'); }
  const now = dependencies.now ?? Date.now, plan = validatePlan(input, now());
  if (options.mode === 'plan') return describePlan(plan); // Never inspect credentials or import a browser.
  const out = resolve(options.out);
  requireCheck(out.startsWith('/workspace/') || out.startsWith('/tmp/'), 'output_invalid');
  // No dotenv, env pull, key generation, fixture creation, Supabase admin users,
  // schema application, provider management, deployment, or business mutation.
  // Credentials are supplied by an authorized secret-injection step only after
  // a concrete plan has been approved. Do not pass values in argv or JSON.
  const getCredentials = dependencies.getCredentials ?? (() => ({
    anon: process.env.NATORI_CASE_HOSTED_ANON_KEY,
    service: process.env.NATORI_CASE_HOSTED_SERVICE_ROLE_KEY,
    staff: process.env.NATORI_CASE_HOSTED_STAFF_PASSWORD,
    outsider: process.env.NATORI_CASE_HOSTED_OUTSIDER_PASSWORD,
  }));
  // Validate the approval before even reading injected credentials or making an
  // output directory. Importing runner is side-effect free.
  const { approvePlan } = await import('./config.mjs'); approvePlan(plan, options.digest);
  let deploymentEvidence;
  try { deploymentEvidence = JSON.parse(await read(options.evidence, 'utf8')); }
  catch { throw new HostedAcceptanceError('deployment_evidence_required'); }
  validateDeploymentEvidence(plan, deploymentEvidence, now());
  await mkdir(out, { mode: 0o700 }); // New directory only; never overwrite another run.
  let result;
  try {
    const openBrowser = dependencies.openBrowser ?? (await import('./browser.mjs')).openHostedBrowser;
    result = await runHostedReadOnly({ input: plan, approvedDigest: options.digest, deploymentEvidence, credentials: getCredentials(),
      transport: dependencies.transport ?? globalThis.fetch, openBrowser, now });
    return result;
  } catch (error) {
    result = { success: false, error: error instanceof HostedAcceptanceError ? error.code : 'hosted_read_unconfirmed' };
    throw new HostedAcceptanceError(result.error);
  } finally {
    // No raw exception/body/URL log, auth state, password, cookie, or HTML.
    await writeFile(resolve(out, 'result.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await main(process.argv.slice(2)), null, 2)); }
  catch (error) {
    console.error(JSON.stringify({ success: false, error: error instanceof HostedAcceptanceError ? error.code : 'hosted_read_unconfirmed' }));
    process.exitCode = 1;
  }
}
