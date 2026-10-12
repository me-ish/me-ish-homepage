import { config, root, directory } from './common.mjs';
import {spawn} from 'node:child_process';
const cfg=config;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',new URL(config.app).port],{
 cwd:root,stdio:'inherit',env:{PATH:process.env.PATH,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_SUPABASE_URL:config.api,NEXT_PUBLIC_SUPABASE_ANON_KEY:cfg.anon,SUPABASE_SERVICE_ROLE_KEY:cfg.service,NEXT_PUBLIC_SITE_URL:config.app,ADMIN_API_TOKEN:'pr162-local-admin-only',CERT_ONE_TIME:'0',CERT_LINK_TTL_DAYS:'7',NATORI_DASHBOARD_KEY:'pr162-local-dashboard-only',NEXT_FONT_GOOGLE_MOCKED_RESPONSES:root+'scripts/legacy-entry-read-security/acceptance/font-responses.cjs'},
});
process.on('SIGTERM',()=>child.kill('SIGTERM'));process.on('SIGINT',()=>child.kill('SIGTERM'));child.on('exit',code=>process.exit(code??1));
