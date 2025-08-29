// src/lib/isAdmin.ts

/** ADMIN_EMAILS に含まれているかを判定する */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;

  const e = email.trim().toLowerCase();

  // ADMIN_EMAILS を分解（カンマ/改行/空白区切り）
  const raw = (process.env.ADMIN_EMAILS || "")
    .split(/[,\n\s]+/)
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (raw.length === 0) return false;

  // 完全一致（メールアドレス列）
  if (raw.includes(e)) return true;

  // ドメイン一致（先頭に @ を付けて登録している想定 / どちらでも許容）
  const domain = e.split("@")[1];
  if (domain) {
    if (raw.includes(`@${domain}`) || raw.includes(domain)) return true;
  }

  // （任意）Gmail の正規化：+以降を削除、ローカル部のドットを無視
  const [local, dom] = e.split("@");
  if (dom === "gmail.com" || dom === "googlemail.com") {
    const gmailNormalized = `${local.replace(/\+.*/, "").replace(/\./g, "")}@gmail.com`;
    if (raw.includes(gmailNormalized)) return true;
  }

  return false;
}
