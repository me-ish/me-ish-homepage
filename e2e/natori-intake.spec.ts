import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/ja/etorie/demo/app/portfolio";
const TWO_MIB_PLUS_ONE = 2 * 1024 * 1024 + 1;

async function openInquiry(page: Page, label = "まず相談したい") {
  await page.locator("#form").getByRole("link", { name: label }).click();
  await expect(page).toHaveURL(/\/portfolio\/contact\?/);
  await expect(page.getByRole("heading", { name: "ご相談・ご依頼", exact: true })).toBeVisible();
}

async function fillContact(page: Page, suffix: string) {
  await page.getByLabel(/お名前/).fill(`P1-13 ${suffix}`);
  await page.getByLabel(/メールアドレス/).fill(`p1-13-${suffix}@example.com`);
}

test.describe("Natori public intake rollout", () => {
  test.beforeEach(async ({ page }) => {
    // デモ受付・ブラウザ検証からAPIや外部サービスへ書き込まない。
    await page.route("**/*", async (route) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      } else {
        await route.continue();
      }
    });
  });

  test("structured consultation flow validates and confirms on a scrollable page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${DEMO_PATH}?structured=1`);
    await openInquiry(page);
    await page.getByRole("button", { name: "内容を確認する" }).click();
    await expect(page.getByLabel(/お名前/)).toBeFocused();
    await fillContact(page, "consultation");
    await page.getByLabel("ご相談・ご依頼の内容").fill("安全なデモ送信です。");
    const scroll = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, viewport: innerHeight }));
    expect(scroll.height).toBeGreaterThan(scroll.viewport);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.getByRole("button", { name: "内容を確認する" })).toBeInViewport();
    await expect(page.getByLabel("ご相談・ご依頼の内容")).toHaveValue("安全なデモ送信です。");
    await page.getByRole("button", { name: "内容を確認する" }).click();
    const notice = page.getByText(/このフォームは、ご相談・お見積もりの受付フォームです/);
    const submit = page.getByRole("button", { name: "相談内容を送信する" });
    await expect(notice).toBeVisible();
    await expect(submit).toBeVisible();
    await submit.click();
    await expect(page.getByRole("heading", { name: "送信ありがとうございます!" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("structured quote flow separates production details, conditions, and review", async ({ page }) => {
    await page.goto(`${DEMO_PATH}?structured=1`);
    await openInquiry(page, "見積もりをお願いしたい");
    await expect(page.getByRole("radio", { name: "見積もりを希望" })).toBeChecked();
    await expect(page.getByLabel("ご依頼の種類")).toBeVisible();
    await expect(page.getByLabel("ご予算")).toBeHidden();
    await page.getByRole("button", { name: "条件・連絡先へ" }).click();
    await expect(page.getByRole("heading", { name: "ご希望の条件と連絡先" })).toBeFocused();
    await expect(page.getByLabel("ご予算")).toBeVisible();
    await expect(page.getByLabel(/お名前/)).toBeVisible();
    await fillContact(page, "quote");
    await page.getByLabel("商用利用").selectOption("yes");
    await page.getByLabel(/作品の公開可否/).selectOption("fully_private");
    await page.getByRole("button", { name: "内容を確認する" }).click();
    await expect(page.getByText("用途・条件")).toBeVisible();
    await expect(page.getByText("商用利用：商用利用する")).toBeVisible();
    await expect(page.getByText("実績掲載：完全非公開")).toBeVisible();
    await page.getByRole("button", { name: "見積もりを依頼する" }).click();
    await expect(page.getByRole("heading", { name: "送信ありがとうございます!" })).toBeVisible();
  });

  test("mobile plan and hero links open a dedicated contact page", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto(DEMO_PATH);
    await page.getByRole("link", { name: "相談・見積もり" }).first().click();
    await expect(page).toHaveURL(/\/portfolio\/contact/);
    await expect(page.getByRole("heading", { name: "ご相談・ご依頼", exact: true })).toBeVisible();
    await page.goBack();
    const firstPlan = page.getByRole("link", { name: "このプランで相談" }).first();
    const planId = new URL(await firstPlan.getAttribute("href") ?? "", page.url()).searchParams.get("plan");
    await firstPlan.click();
    await expect(page).toHaveURL(new RegExp(`plan=${planId}`));
    await expect(page.getByRole("heading", { name: "ご相談・ご依頼", exact: true })).toBeVisible();
  });

  test("keeps the legacy form as the default and requires review", async ({ page }) => {
    await page.goto(DEMO_PATH);
    await openInquiry(page);
    await expect(page.getByLabel("ご依頼の詳細")).toBeVisible();
    await fillContact(page, "legacy");
    await page.getByRole("button", { name: "次へ進む" }).click();
    await expect(page.getByRole("button", { name: "この内容で送信する" })).toBeVisible();
    await page.getByRole("button", { name: "この内容で送信する" }).click();
    await expect(page.getByRole("heading", { name: "送信ありがとうございます!" })).toBeVisible();
  });

  test("rejects combined reference images above 4MiB", async ({ page }) => {
    await page.goto(DEMO_PATH);
    await openInquiry(page);
    await page.locator('input[type="file"]').setInputFiles([
      { name: "reference-a.png", mimeType: "image/png", buffer: Buffer.alloc(TWO_MIB_PLUS_ONE) },
      { name: "reference-b.png", mimeType: "image/png", buffer: Buffer.alloc(TWO_MIB_PLUS_ONE) },
    ]);
    await expect(page.getByText("画像の合計サイズは4MBまでです。", { exact: true })).toBeVisible();
  });
});
