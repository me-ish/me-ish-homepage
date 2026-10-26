// Dependency-free gate used BEFORE extraction/npm install, before setup, and
// before the application build. It reads only nonsecret target configuration.
import { pathToFileURL } from 'node:url';

export function assertInitialPreviewPlatform(env) {
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL_TARGET_ENV !== 'preview'
    || env.VERCEL_PROJECT_ID !== 'prj_naQn1RrcnOGk6PcNCZsWOTuFuENz') throw Error('setup_platform_mismatch');
  const url = 'https://vflqlsmblwiwrukjwwec.supabase.co';
  if (env.SUPABASE_URL !== url || env.NEXT_PUBLIC_SUPABASE_URL !== url
    || env.NATORI_CASE_DASHBOARD_PREVIEW_ENABLED !== 'read-only'
    || env.NATORI_NOTIFICATION_SENDING_ENABLED !== '0') throw Error('setup_readonly_target_mismatch');
  return { environment: 'preview', project: env.VERCEL_PROJECT_ID, databaseRef: 'vflqlsmblwiwrukjwwec' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(assertInitialPreviewPlatform(process.env))); }
  catch { console.error('[initial-preview] platform_gate_denied'); process.exitCode = 1; }
}
