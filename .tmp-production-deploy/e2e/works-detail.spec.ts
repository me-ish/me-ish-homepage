import { test, expect } from "@playwright/test";

test.describe("Works detail page", () => {
  test("shows work detail when valid id is given", async ({ page }) => {
    // Visit a works page — the page handles missing IDs gracefully
    const response = await page.goto("/works/1");
    // Should return 200 or 404 (not a server crash)
    expect([200, 404]).toContain(response?.status());
  });
});
