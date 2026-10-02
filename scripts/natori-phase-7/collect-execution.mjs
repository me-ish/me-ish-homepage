import { existsSync, readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const target = process.argv[2], base = process.argv[3] || null;
if (!target || !/\/natori-phase-t\.[A-Za-z0-9]+\/browser-app$/.test(target) || !existsSync(resolve(target, 'source-checksums.json'))
  || realpathSync(target) === realpathSync(process.cwd()) || (base !== null && !/^[a-f0-9]{40}$/.test(base))) throw new Error('EXECUTION_TARGET_REJECTED');
const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
if (head.status !== 0 || dirty.status !== 0 || !/^[a-f0-9]{40}$/.test(head.stdout.trim())) throw new Error('EXECUTION_HEAD_UNAVAILABLE');
const checksum = readFileSync(resolve(target, 'source-checksums.json'));
const run = process.env.GITHUB_RUN_ID;
writeFileSync(resolve(target, 'phase7-execution.json'), JSON.stringify({ head_sha: head.stdout.trim(), base_sha: base,
  tracked_source_dirty: dirty.stdout.trim().length > 0,
  ci_run_url: typeof run === 'string' && /^\d+$/.test(run) ? `https://github.com/me-ish/me-ish-homepage/actions/runs/${run}` : null,
  source_checksum_sha256: createHash('sha256').update(checksum).digest('hex'), runtime: 'Existing Phase T sealed internal network and inherited kernel firewall; ephemeral DB/auth only',
  art: 'Generated synthetic artwork; preserves actual component decoration, does not establish artist preference',
  fonts: 'Pinned official full Fredoka and Zen Maru Gothic assets through installed Next test-only CSS transport',
  real_provider_verified: false, notification_sending_enabled: false, human_evaluation_status: 'pending_actual_capture_review',
}, null, 2));
