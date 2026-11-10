// features/natori/lib/emailTypoSuggestion.ts
// メールアドレスのドメインの打ち間違い（gmial.com など）に気づいてもらうための純関数。
// 提案するだけで、入力を書き換えるのは本人がボタンを押したときだけ。

const COMMON_DOMAINS = [
  "gmail.com",
  "icloud.com",
  "yahoo.co.jp",
  "outlook.com",
  "hotmail.com",
  "docomo.ne.jp",
  "ezweb.ne.jp",
  "softbank.ne.jp",
] as const;

/** 実在する似たドメイン。これらは打ち間違いとみなさない。 */
const KNOWN_VALID_DOMAINS = new Set<string>([
  ...COMMON_DOMAINS,
  "ymail.com",
  "mail.com",
  "email.com",
  "googlemail.com",
  "me.com",
  "mac.com",
  "yahoo.com",
  "yahoo.ne.jp",
  "outlook.jp",
  "hotmail.co.jp",
  "live.jp",
  "live.com",
  "au.com",
  "i.softbank.jp",
  "gmx.com",
]);

/** 隣り合う2文字の入れ替えも1回と数える編集距離（Damerau–Levenshtein の制限版）。 */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * よく使われるドメインの打ち間違いらしいとき、直したアドレス全体を返す。
 * 該当しない・判断できないときは null。
 */
export function suggestEmailDomain(email: string): string | null {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  if (domain.length < 6 || KNOWN_VALID_DOMAINS.has(domain)) return null;
  let best: { domain: string; distance: number } | null = null;
  let tie = false;
  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance < 1 || distance > 2) continue;
    if (!best || distance < best.distance) {
      best = { domain: candidate, distance };
      tie = false;
    } else if (distance === best.distance) {
      tie = true;
    }
  }
  if (!best || tie) return null;
  return `${local}@${best.domain}`;
}
