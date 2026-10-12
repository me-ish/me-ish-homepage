import { spawn } from "node:child_process";
import { config, root, directory } from "./common.mjs";
import { assertNoEnvFiles } from "./env-guard.mjs";
assertNoEnvFiles(root);
const child = spawn(
  process.execPath,
  [
    "--dns-result-order=ipv4first",
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "localhost",
    "--port",
    new URL(config.app).port,
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: config.api,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: config.anon,
      SUPABASE_SERVICE_ROLE_KEY: config.service,
      NEXT_PUBLIC_SITE_URL: config.app,
      NATORI_OWNER_USER_ID: config.users[0].id,
      NATORI_STAFF_EMAILS: config.users[0].email,
      SEC01_ACCEPTANCE_DIR: directory,
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES:
        root + "scripts/natori-private-assets/font-responses.cjs",
    },
  },
);
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
