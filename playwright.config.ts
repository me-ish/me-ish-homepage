import { defineConfig, devices } from "@playwright/test";
import { setDefaultResultOrder } from "node:dns";

// NextURL normalizes loopback IPs to localhost. Keep the server hostname and
// request origin identical so next-intl rewrites stay internal, using IPv4.
setDefaultResultOrder("ipv4first");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    // Public pages (no auth required)
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/mypage.spec.ts", "**/admin.spec.ts"],
    },
    // Auth setup (runs before authenticated tests)
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // Authenticated user tests
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      testMatch: ["**/mypage.spec.ts"],
      dependencies: ["setup"],
    },
    // Admin tests
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      testMatch: ["**/admin.spec.ts"],
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname localhost",
    url: "http://localhost:3000",
    timeout: 120000,
    reuseExistingServer: false,
    stdout: "pipe",
    env: {
      NODE_OPTIONS: "--dns-result-order=ipv4first",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-placeholder",
    },
  },
});
