import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows hero section", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/me-ish/i);
    const hero = page.locator("main").first();
    await expect(hero).toBeVisible();
  });

  test("navigation links are present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible();
  });
});
