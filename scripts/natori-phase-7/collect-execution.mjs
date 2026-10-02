import { existsSync, readFileSync, writeFileSync, realpathSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Only known public source/cache paths may be named and hashed. Other tracked
// files contribute a redacted count; their paths and contents are never emitted.
const publicStatusExtras = new Set([".github/workflows/natori-phase-6a.yml",".github/workflows/natori-phase-6b.yml",".github/workflows/natori-phase-7.yml","docs/natori/Natori_Phase_7_Runbook.md","next-env.d.ts","next.config.mjs","package.json","postcss.config.js","scripts/natori-phase-0b/fixture.sql","scripts/natori-phase-0b/prepare-browser.mjs","scripts/natori-phase-3b/browser.mjs","scripts/natori-phase-3b/integration.ts","scripts/natori-phase-5/browser-cases.mjs","scripts/natori-phase-5/browser.mjs","scripts/natori-phase-5/prepare-browser.mjs","scripts/natori-phase-6a/alias-preflight.sql","scripts/natori-phase-6a/browser.mjs","scripts/natori-phase-6a/build-fixture.mjs","scripts/natori-phase-6a/build.mjs","scripts/natori-phase-6a/dry-run-corrections.sql","scripts/natori-phase-6a/integration.ts","scripts/natori-phase-6a/prepare-browser.mjs","scripts/natori-phase-6a/schema-preflight.mjs","scripts/natori-phase-6a/standalone-read-prerequisites.sql","scripts/natori-phase-6b/browser.mjs","scripts/natori-phase-6b/prepare-browser.mjs","scripts/natori-phase-7/browser.mjs","scripts/natori-phase-7/build.mjs","scripts/natori-phase-7/collect-execution.mjs","scripts/natori-phase-7/fixtures.ts","scripts/natori-phase-7/font-assets.json","scripts/natori-phase-7/font-responses.cjs","scripts/natori-phase-7/ipv4-port-controls.mjs","scripts/natori-phase-7/prepare-browser.mjs","scripts/natori-phase-7/prepare-fonts.mjs","scripts/natori-phase-7/screen-evidence.template.json","scripts/natori-phase-7/seed-fixtures.mjs","scripts/natori-phase-7/visual-lifecycle.mjs","scripts/natori-phase-7/visual-server.mjs","scripts/natori-phase-n/browser.mjs","scripts/natori-phase-n/build-fixture.mjs","scripts/natori-phase-n/run-browser.sh","scripts/natori-phase-t/run.sh","src/app/[locale]/layout.tsx","src/app/[locale]/natori/consult/[token]/page.tsx","src/app/[locale]/natori/dashboard/layout.tsx","src/app/[locale]/natori/dashboard/notification-check/page.tsx","src/app/[locale]/natori/dashboard/page.tsx","src/app/[locale]/natori/delivery/[token]/page.tsx","src/app/[locale]/natori/projects/page.tsx","src/app/admin-login/AdminLoginClient.tsx","src/app/admin-login/page.tsx","src/app/api/natori/admin/consultation/route.ts","src/app/api/natori/admin/events/route.ts","src/app/api/natori/admin/notification-verification/route.ts","src/app/api/natori/admin/notifications/route.ts","src/app/api/natori/admin/page-events/route.ts","src/app/api/natori/admin/payment-link/route.ts","src/app/api/natori/admin/pricing/route.ts","src/app/api/natori/admin/profile/route.ts","src/app/api/natori/admin/quote-notification/route.ts","src/app/api/natori/consult/[token]/route.ts","src/app/api/natori/consultation-file/route.ts","src/app/api/natori/delivery/accept/route.ts","src/app/api/natori/portfolio/contact/route.ts","src/app/api/natori/quote/accept/route.ts","src/app/api/webhook/stripe/route.ts","src/app/globals.css","src/app/layout.tsx","src/features/natori/components/dashboard/inquiry/__tests__/InquiryRequestSummary.fullText.test.tsx","src/features/natori/components/portfolio/__tests__/PortfolioHero.test.tsx","src/features/natori/components/portfolio/__tests__/PortfolioHeroSlider.test.tsx","src/features/natori/components/portfolio/__tests__/PortfolioLanding.test.tsx","src/features/natori/components/portfolio/__tests__/PortfolioMobileCta.test.tsx","src/features/natori/components/portfolio/__tests__/PortfolioStructuredCommissionForm.test.tsx","src/features/natori/constants/__tests__/natoriPrimaryAction.test.ts","src/features/natori/constants/__tests__/portfolioDesignTokens.test.ts","src/features/natori/lib/__tests__/fixtures/portfolioWorkflow.public-20261001.json","src/features/natori/lib/__tests__/portfolioWorkflow.test.ts","src/features/natori/server/__tests__/portfolioContactStructuredMail.test.ts","src/features/natori/server/__tests__/portfolioSiteWorkflowRead.test.tsx","src/features/natori/server/__tests__/portfolioWorkflowImportantConditions.test.tsx","src/features/natori/server/__tests__/portfolioWorkflowSaveReload.test.tsx","src/middleware.ts","supabase/.temp/cli-latest","supabase/baseline/manifest.json","supabase/migrations/20261001223805_natori_task_integrity.sql","tailwind.config.js","tsconfig.json","tsconfig.tsbuildinfo"]);
const safeStatusPath = value => typeof value === 'string' && !value.startsWith('/') && !value.includes('\\')
  && !value.includes(':') && value.split('/').every(part => part && part !== '..' && !part.startsWith('.env')
    && !['.git', '.codex', '.agents', '.aws', 'sessions'].includes(part))
  && (!value.includes('/.temp/') || value === 'supabase/.temp/cli-latest')
  && !/(?:^|\/)(?:secrets?|credentials?)(?:\.|\/|$)|\.(?:pem|key)$/i.test(value);
function sourceDiagnostics(checksum) {
  const base = { schema_version: 1, status: 'unavailable', status_entry_count: null,
    entries: [], redacted_entry_count: null, omitted_allowlisted_entry_count: null, raw_bytes_normalized: false };
  const git = args => spawnSync('git', args, { encoding: null, stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, maxBuffer: 11000000 });
  const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=no']);
  if (status.status !== 0) return base;
  const paths = new Set([...Object.keys(JSON.parse(checksum.toString('utf8'))), ...publicStatusExtras]);
  const records = status.stdout.toString('utf8').split('\0'), entries = [];
  let total = 0, redacted = 0, omitted = 0, inspected = 0;
  const deadline = Date.now() + 10000, repo = realpathSync(process.cwd());
  const hash = raw => createHash('sha256').update(raw).digest('hex');
  const mode = (raw, index, name) => {
    const rows = raw.toString('utf8').split('\0').filter(Boolean);
    if (rows.length !== 1) return null;
    const [meta, actual] = rows[0].split('\t'), parts = meta?.split(' ');
    return actual === name && parts?.length === 3 && (!index || parts[2] === '0')
      && ['100644', '100755'].includes(parts[0]) ? parts[0] : null;
  };
  for (let i = 0; i < records.length; i++) {
    const record = records[i]; if (!record) continue;
    if (!/^[ MADRCUT?!]{2} /.test(record)) return base;
    const code = record.slice(0, 2), name = record.slice(3); total++;
    if (/[RC]/.test(code)) i++; // Consume the original name without exposing it.
    if (!safeStatusPath(name) || !paths.has(name)) { redacted++; continue; }
    if (entries.length === 64) { omitted++; continue; }
    const row = { path: name, status: code, classification: 'inspection_unavailable', head_mode: null,
      index_mode: null, worktree_executable: null, head_sha256: null, index_sha256: null, worktree_raw_sha256: null };
    entries.push(row);
    if (/[RCU]/.test(code)) { row.classification = 'rename_copy_or_unmerged'; continue; }
    if (inspected >= 16 || Date.now() > deadline) { row.classification = 'inspection_limit'; continue; }
    inspected++;
    try {
      let absolute = repo, unsafe = false;
      for (const part of name.split('/')) { absolute = resolve(absolute, part); if (existsSync(absolute) && lstatSync(absolute).isSymbolicLink()) { unsafe = true; break; } }
      if (unsafe) { row.classification = 'symlink_refused'; continue; }
      if (!existsSync(absolute)) { row.classification = 'worktree_missing'; continue; }
      const stat = lstatSync(absolute);
      if (!stat.isFile() || stat.size > 10000000) { row.classification = 'nonregular_or_oversized'; continue; }
      const headMeta = git(['ls-tree', '-z', 'HEAD', '--', name]), indexMeta = git(['ls-files', '--stage', '-z', '--', name]);
      if (headMeta.status !== 0 || indexMeta.status !== 0) continue;
      row.head_mode = mode(headMeta.stdout, false, name); row.index_mode = mode(indexMeta.stdout, true, name);
      if (!row.head_mode || !row.index_mode) { row.classification = 'git_mode_unavailable'; continue; }
      const head = git(['show', `HEAD:${name}`]), index = git(['show', `:${name}`]);
      if (head.status !== 0 || index.status !== 0 || head.stdout.length > 10000000 || index.stdout.length > 10000000) continue;
      row.head_sha256 = hash(head.stdout); row.index_sha256 = hash(index.stdout);
      row.worktree_raw_sha256 = hash(readFileSync(absolute)); row.worktree_executable = Boolean(stat.mode & 0o100);
      const indexDiff = row.head_sha256 !== row.index_sha256, worktreeDiff = row.index_sha256 !== row.worktree_raw_sha256;
      const modeDiff = row.head_mode !== row.index_mode || (row.index_mode === '100755') !== row.worktree_executable;
      row.classification = indexDiff && worktreeDiff ? 'index_and_worktree_raw_bytes_differ'
        : indexDiff ? 'index_raw_bytes_differ' : worktreeDiff ? 'worktree_raw_bytes_differ'
        : modeDiff ? 'raw_bytes_equal_mode_differs' : 'raw_bytes_and_modes_equal';
    } catch { row.classification = 'inspection_unavailable'; }
  }
  return { ...base, status: 'observed', status_entry_count: total, entries,
    redacted_entry_count: redacted, omitted_allowlisted_entry_count: omitted };
}

const target = process.argv[2], base = process.argv[3] || null;
if (!target || !/\/natori-phase-t\.[A-Za-z0-9]+\/browser-app$/.test(target) || !existsSync(resolve(target, 'source-checksums.json'))
  || realpathSync(target) === realpathSync(process.cwd()) || (base !== null && !/^[a-f0-9]{40}$/.test(base))) throw new Error('EXECUTION_TARGET_REJECTED');
const head = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const dirty = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
if (head.status !== 0 || dirty.status !== 0 || !/^[a-f0-9]{40}$/.test(head.stdout.trim())) throw new Error('EXECUTION_HEAD_UNAVAILABLE');
const checksum = readFileSync(resolve(target, 'source-checksums.json'));
const run = process.env.GITHUB_RUN_ID;
const execution = { head_sha: head.stdout.trim(), base_sha: base,
  tracked_source_dirty: dirty.stdout.trim().length > 0,
  tracked_source_diagnostics: sourceDiagnostics(checksum),
  ci_run_url: typeof run === 'string' && /^\d+$/.test(run) ? `https://github.com/me-ish/me-ish-homepage/actions/runs/${run}` : null,
  source_checksum_sha256: createHash('sha256').update(checksum).digest('hex'), runtime: 'Existing Phase T sealed internal network and inherited kernel firewall; ephemeral DB/auth only',
  art: 'Generated synthetic artwork; preserves actual component decoration, does not establish artist preference',
  fonts: 'Pinned official full Fredoka and Zen Maru Gothic assets through installed Next test-only CSS transport',
  real_provider_verified: false, notification_sending_enabled: false, human_evaluation_status: 'pending_actual_capture_review',
};
const executionRaw = JSON.stringify(execution, null, 2);
writeFileSync(resolve(target, 'phase7-execution.json'), executionRaw);
// Preserve a bounded public receipt before failing; the owned results directory
// already exists and the workflow's existing artifact upload retains this file.
const results = resolve(target, '..', 'results');
if (!existsSync(results) || lstatSync(results).isSymbolicLink() || !lstatSync(results).isDirectory()
  || realpathSync(results) !== resolve(realpathSync(target), '..', 'results')) throw new Error('EXECUTION_RESULTS_TARGET_REJECTED');
writeFileSync(resolve(results, 'phase7-source-execution.json'), executionRaw, { flag: 'wx' });
if (execution.tracked_source_dirty) throw new Error('EXECUTION_TRACKED_SOURCE_DIRTY');
