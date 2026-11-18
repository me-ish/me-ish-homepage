// CI の Security Audit の合否（本番に載る依存のみ）。npm audit --omit=dev の結果のうち high 以上の
// 注意報があれば失敗にする。ただし下の一覧にある注意報だけは、期限までの間に限って合否から外す。
// 期限を過ぎた、または一覧に無い high 以上の注意報が 1 件でもあれば、これまでどおり失敗する。
import { execFileSync } from 'node:child_process';

// 修正版が出ていない注意報だけを、理由と期限を付けて載せる。期限が来たら見直す（延ばすなら理由も更新）。
const temporaryExceptions = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    until: '2026-12-18',
    reason:
      'picomatch の ReDoS。全版が対象で修正版なし（2026-11-18 時点の最新 4.0.7 も該当）。本番依存では ' +
      'next-intl → @parcel/watcher 経由だけで、これは next-intl のメッセージ抽出機能（このリポジトリでは未設定）' +
      'の監視用。攻撃にはグロブのパターンを外部から与える必要があり、このアプリは与えない。',
  },
];

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const today = new Date().toISOString().slice(0, 10);

let raw;
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit は脆弱性があると終了コード 1 を返す。出力が JSON なら続ける。
  raw = error.stdout;
}
const report = JSON.parse(raw);
if (report.error) {
  console.error(`npm audit failed: ${report.error.summary ?? 'unknown error'}`);
  process.exit(1);
}

const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via === 'string') continue; // 他パッケージ経由の印。元の注意報は別の行に出る。
    const id = via.url?.split('/').pop() ?? String(via.source);
    advisories.set(id, { id, severity: via.severity, title: via.title, name: via.name, range: via.range });
  }
}

const failures = [];
for (const advisory of advisories.values()) {
  if ((severityRank[advisory.severity] ?? 0) < severityRank.high) continue;
  const exception = temporaryExceptions.find(entry => entry.id === advisory.id);
  if (exception && today <= exception.until) {
    console.log(`::warning title=Security Audit::${advisory.id}（${advisory.name} ${advisory.range}）は ${exception.until} まで一時的に合否から外しています。理由: ${exception.reason}`);
    continue;
  }
  failures.push(advisory);
  const note = exception ? `（一時除外の期限 ${exception.until} を過ぎています）` : '';
  console.log(`::error title=Security Audit::${advisory.severity}: ${advisory.id} ${advisory.name} ${advisory.range} ${advisory.title}${note}`);
}

for (const exception of temporaryExceptions) {
  if (!advisories.has(exception.id)) console.log(`::notice title=Security Audit::${exception.id} は今回の結果に出ていません。一時除外の一覧から外せます。`);
}

console.log(`Security Audit: high 以上 ${failures.length} 件（一時除外を除く）`);
process.exit(failures.length ? 1 : 0);
