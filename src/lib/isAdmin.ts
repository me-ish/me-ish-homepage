// サーバー専用で使う（env を読むため）
export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? '')
    .split(/[,\s]+/)             // カンマ/空白区切り
    .filter(Boolean)
    .map(s => s.trim().toLowerCase());
  return list.includes(email.trim().toLowerCase());
}
