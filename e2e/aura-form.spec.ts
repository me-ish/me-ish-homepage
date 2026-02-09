import { test, expect } from "@playwright/test";

test.describe("AURA form", () => {
  test("loads the form page", async ({ page }) => {
    await page.goto("/aura/form");
    await page.waitForLoadState("networkidle");
    // The form wizard should be visible
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
  });

  test("stepper navigation is present", async ({ page }) => {
    await page.goto("/aura/form");
    await page.waitForLoadState("networkidle");
    // Step navigation should be visible (buttons or step indicators)
    const nav = page.locator("nav, [role='navigation']").or(
      page.getByText(/次へ/)
    );
    await expect(nav.first()).toBeVisible();
  });
});
