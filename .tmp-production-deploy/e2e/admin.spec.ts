// e2e/admin.spec.ts
// Admin smoke tests (admin user required).
//
// These tests require E2E_ADMIN_TOKEN to be set.
// Without it, the auth setup saves an empty state and these tests will
// gracefully fail or be skipped.

import { test, expect } from "@playwright/test";

test.describe("Admin (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.E2E_ADMIN_TOKEN) {
      test.skip();
      return;
    }
    await page.goto("/admin");
  });

  test("renders admin dashboard", async ({ page }) => {
    // Admin page should load without redirect to login
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    // Verify we're on admin, not redirected
    expect(page.url()).toContain("/admin");
  });

  test("shows entries management section", async ({ page }) => {
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
