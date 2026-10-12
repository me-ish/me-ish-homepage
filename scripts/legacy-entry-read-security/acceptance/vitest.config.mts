import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
export default defineConfig({
  test:{environment:'node',include:['scripts/legacy-entry-read-security/acceptance/certificate.test.ts'],testTimeout:10000},
  resolve:{alias:{'@':`${root}src`,'server-only':`${root}node_modules/server-only/empty.js`}},
});
