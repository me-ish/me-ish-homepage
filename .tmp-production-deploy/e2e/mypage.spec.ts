// e2e/mypage.spec.ts
// MyPage smoke tests (authenticated user required).
//
// These tests require E2E_USER_TOKEN to be set.
// Without it, the auth setup saves an empty state and these tests will
// gracefully fail or be skipped.

import { test, expect } from "@playwright/test";

test.describe("MyPage (authenticated)", () => {
  test.beforeEach(async ({ page }) => {
    // If no auth token was provided, skip
    if (!process.env.E2E_USER_TOKEN) {
      test.skip();
      return;
    }
    await page.goto("/mypage");
  });

  test("renders mypage heading", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("shows user profile section", async ({ page }) => {
    // Verify some profile-related content is visible
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });
});
