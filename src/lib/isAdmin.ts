export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const raw = process.env.ADMIN_EMAILS ?? ''; // "a@x.com,b@y.com"
  const allow = new Set(
    raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );
  return allow.has(email.toLowerCase());
}
