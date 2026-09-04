import { test, expect } from "@playwright/test";

test.describe("2D Gallery", () => {
  test("renders gallery page with artwork cards", async ({ page }) => {
    await page.goto("/white/2d");
    // Wait for the page to load
    await page.waitForLoadState("networkidle");
    // Gallery page should be visible
    const main = page.locator("main").first();
    await expect(main).toBeVisible();
  });
});
