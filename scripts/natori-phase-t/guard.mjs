export function validateOrigin(value, allowed) {
  let u;
  try { u = new URL(value); } catch { throw new Error('PHASE_T_DESTINATION_REJECTED'); }
  if (!/^http:\/\/172\.30\.250\.\d+:8000$/.test(allowed) ||
      value !== allowed || u.origin !== allowed || u.username || u.password || u.search || u.hash) {
    throw new Error('PHASE_T_DESTINATION_REJECTED');
  }
  return u.origin;
}
export function guardedFetch(base, allowed, transport = fetch) {
  validateOrigin(base, allowed); // Before creating any network request.
  return async (path, init = {}) => {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('PHASE_T_PATH_REJECTED');
    const u = new URL(path, base);
    if (u.origin !== allowed) throw new Error('PHASE_T_DESTINATION_REJECTED');
    return transport(u, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
  };
}
