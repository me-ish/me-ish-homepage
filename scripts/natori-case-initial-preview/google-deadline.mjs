// Nonsecret, fixed authorization boundary for this single approved Preview.
// It expires new reads/auth callbacks; it does not erase already viewed data
// or claim to delete the person's Supabase Auth identity/session.
export const GOOGLE_READ_ENDS_AT = '2026-10-25T00:00:00Z';
export function googleReadAccessAllowed(configured, now = Date.now()) {
  return configured === GOOGLE_READ_ENDS_AT && Number.isFinite(now)
    && now < Date.parse(GOOGLE_READ_ENDS_AT);
}
export function assertGoogleReadAccess(env, now = Date.now()) {
  if (!googleReadAccessAllowed(env.NATORI_CASE_GOOGLE_STAFF_EXPIRES_AT, now)) throw Error('google_preflight_access_expired');
}
