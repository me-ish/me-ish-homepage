// src/lib/isAdmin.ts

/** ADMIN_EMAILS(カンマ/改行区切り)に含まれているかを判定 */
export function isAdminEmail(email?: string | null): boolean {
  const list = (process.env.ADMIN_EMAILS || '')
    .split(/[,\n]/)               // カンマ or 改行で分割
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  if (!email) return false;
  const e = email.toLowerCase();

  // ※Gmail のドット/プラスを無視したいときは下を使う
  // const normalized = e.replace(/(\+.*)@/, '@').replace(/\.(?=[^@]+@)/g, '');
  // return list.includes(normalized) || list.includes(e);

  return list.includes(e);
}
