import { expect, test } from "@playwright/test";

const PROD_URL = "https://www.me-ish.art/natori/portfolio";
const runId = process.env.GITHUB_RUN_ID ?? "manual";

async function fillIdentity(page: import("@playwright/test").Page, kind: string) {
  await page
    .getByLabel("お名前（活動名でOK）")
    .fill(`[本番動作確認] ${kind} ${runId}`);
  await page
    .getByLabel("メールアドレス")
    .fill(`natori-production-smoke-${kind}-${runId}@example.com`);
  await page
    .getByLabel(/ご相談・ご依頼の内容/)
    .fill("本番フォーム動作確認です。実案件ではありません。確認後削除してください。");
}

test.describe.configure({ mode: "serial" });

test.describe("Natori production intake smoke", () => {
  test("normal pricing CTA reaches production intake successfully", async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });

    const pricing = page.locator("#pricing");
    const sdCard = pricing.getByRole("heading", { name: "SDキャラ" }).locator("..");
    await sdCard.getByRole("link", { name: "このプランで相談" }).click();

    await expect(page.getByRole("radio", { name: "見積りを希望" })).toBeChecked();
    await expect(page.getByLabel("ご依頼の種類")).toHaveValue("sd");

    await fillIdentity(page, "normal");
    await page.getByRole("button", { name: "この内容で送信する" }).click();

    await expect(page.getByText("送信ありがとうございます!", { exact: true })).toBeVisible();
  });

  test("mass-production pricing CTA reaches production intake successfully", async ({ page }) => {
    await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });

    const pricing = page.locator("#pricing");
    await pricing.getByRole("link", { name: "このプランで相談" }).last().click();

    await expect(page.getByRole("radio", { name: "見積りを希望" })).toBeChecked();
    await expect(page.getByLabel("ご依頼の種類")).toHaveValue(
      "mass_production_illustration"
    );

    await page.getByLabel("デザイン必須").selectOption("おばけ");
    await page.getByLabel("表情指定必須").fill("本番スモークテスト用の笑顔");
    await fillIdentity(page, "mass");
    await page.getByRole("button", { name: "この内容で送信する" }).click();

    await expect(page.getByText("送信ありがとうございます!", { exact: true })).toBeVisible();
  });
});
