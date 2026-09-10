import { expect, test, type Page, type TestInfo } from "@playwright/test";

const PRODUCTION_URL = "https://www.me-ish.art/natori/portfolio";
const SECTIONS = ["hero", "gallery", "pricing", "flow", "about", "requests", "form"] as const;

async function attachPng(testInfo: TestInfo, name: string, body: Buffer) {
  await testInfo.attach(name, { body, contentType: "image/png" });
}

async function capture(
  page: Page,
  testInfo: TestInfo,
  name: string,
  width: number,
  height: number
) {
  await page.setViewportSize({ width, height });
  const response = await page.goto(PRODUCTION_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  expect(response?.ok()).toBeTruthy();
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1_000);

  await attachPng(
    testInfo,
    `${name}-full`,
    await page.screenshot({ fullPage: true })
  );

  for (const id of SECTIONS) {
    const section = page.locator(`#${id}`);
    if ((await section.count()) === 0) continue;
    await attachPng(testInfo, `${name}-${id}`, await section.screenshot());
  }

  const metrics = await page.evaluate((ids) => {
    const rows = ids
      .map((id) => {
        const element = document.getElementById(id);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          id,
          top: rect.top + window.scrollY,
          bottom: rect.bottom + window.scrollY,
          height: rect.height,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
          backgroundColor: style.backgroundColor,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      top: number;
      bottom: number;
      height: number;
      paddingTop: string;
      paddingBottom: string;
      backgroundColor: string;
    }>;

    return rows.map((row, index) => ({
      ...row,
      gapFromPrevious: index === 0 ? null : row.top - rows[index - 1].bottom,
    }));
  }, [...SECTIONS]);

  await testInfo.attach(`${name}-metrics`, {
    body: Buffer.from(
      JSON.stringify({ viewport: { width, height }, sections: metrics }, null, 2),
      "utf8"
    ),
    contentType: "application/json",
  });
}

test("capture current production portfolio for spacing and color audit", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await capture(page, testInfo, "mobile-390", 390, 844);
  await capture(page, testInfo, "desktop-1440", 1440, 900);
});
