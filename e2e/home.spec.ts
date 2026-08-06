import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows the me-ish brand", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/me-ish/i);
    await expect(page.getByText("me-ish", { exact: true })).toBeVisible();
  });

  test("shows the current gallery pause notice", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("me-ish gallery は現在休止中です", { exact: true })).toBeVisible();
  });
});
