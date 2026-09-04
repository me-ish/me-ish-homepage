import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/ja/etorie/demo/app/portfolio";

async function submitMinimumRequest(
  page: Page,
  suffix: string
) {
  await page.getByLabel("お名前（活動名でOK）").fill(`P1-13 ${suffix}`);
  await page.getByLabel("メールアドレス").fill(`p1-13-${suffix}@example.com`);
  const details = page.getByLabel("ご相談・ご依頼の内容");
  if (await details.isVisible()) await details.fill("P1-13 の安全なデモ送信です。");
  await page.getByRole("button", { name: "この内容で送信する" }).click();
  await expect(page.getByText("送信ありがとうございます!", { exact: true })).toBeVisible();
}

test.describe("Natori public intake rollout", () => {
  test("keeps the legacy form as the default", async ({ page }) => {
    await page.goto(DEMO_PATH);

    await expect(page.getByRole("heading", { name: /ご相談か、お見積もりか/ })).toHaveCount(0);
    await expect(page.getByLabel("ご依頼の詳細")).toBeVisible();
    await submitMinimumRequest(page, "legacy");
  });

  test("submits the structured consultation flow without external writes", async ({ page }) => {
    await page.goto(`${DEMO_PATH}?structured=1`);

    await expect(page.getByRole("heading", { name: /ご相談か、お見積もりか/ })).toBeVisible();
    await expect(page.getByRole("radio", { name: "まず相談したい" })).toBeChecked();
    await submitMinimumRequest(page, "consultation");
  });

  test("submits the structured quote flow without external writes", async ({ page }) => {
    await page.goto(`${DEMO_PATH}?structured=1`);

    await page.getByRole("radio", { name: "見積もりを希望" }).check();
    await expect(page.getByRole("radio", { name: "見積もりを希望" })).toBeChecked();
    await submitMinimumRequest(page, "quote");
  });
});
