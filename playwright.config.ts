import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
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
    command: "npm run dev -- --hostname 127.0.0.1",
    url: "http://127.0.0.1:3000",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder",
      SUPABASE_SERVICE_ROLE_KEY: "e2e-placeholder",
    },
  },
});
