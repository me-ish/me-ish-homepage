import { expect, test, type Page } from "@playwright/test";

const DEMO_PATH = "/ja/etorie/demo/app/portfolio";

async function submitMinimumRequest(
  page: Page,
  suffix: string
) {
  await page.getByLabel(/お名前/).fill(`P1-13 ${suffix}`);
  await page.getByLabel("メールアドレス").fill(`p1-13-${suffix}@example.com`);
  const details = page.getByLabel("ご相談・ご依頼の内容");
  if (await details.isVisible()) await details.fill("P1-13 の安全なデモ送信です。");
  await page.getByRole("button", { name: /^(この内容で送信する|相談内容を送信する|見積もり相談を送信する)$/ }).click();
  await expect(page.getByText("送信ありがとうございます!", { exact: true })).toBeVisible();
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

  test("mobile quote keeps optional sections collapsed and recovers from validation", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEMO_PATH}?structured=1`);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const mode = page.getByRole("radio", { name: "まず相談したい" });
    await mode.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "見積りを希望" })).toBeChecked();
    await expect(page.locator("#pf-request-type")).toBeVisible();
    await expect(page.locator("#pf-budget-kind")).not.toBeVisible();
    await expect(page.locator("#pf-character")).not.toBeVisible();
    await page.getByLabel(/お名前/).fill("フォーム検証");
    await page.getByLabel("メールアドレス").fill("form-review@example.com");
    await page.locator("#pf-message").fill("内容を保持したまま修正します。");
    await page.locator("#pf-request-type").selectOption("other");
    await page.getByRole("radio", { name: "まず相談したい" }).check();
    await expect(page.locator("#pf-request-type-other")).not.toBeVisible();
    await page.getByRole("button", { name: "相談内容を送信する" }).click();
    await expect(page.locator("#pf-request-type-other")).toBeFocused();
    await expect(page.locator("#pf-request-type-other")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#pf-budget-kind")).not.toBeVisible();
    await expect(page.locator("#pf-message")).toHaveValue("内容を保持したまま修正します。");
    await expect(page.getByText("送信ありがとうございます!", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath("mobile-form-error.png") });
    await page.locator("#pf-request-type-other").fill("記念イラスト");
    await page.getByRole("button", { name: "相談内容を送信する" }).click();
    await expect(page.getByRole("heading", { name: "送信ありがとうございます!" })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("mobile form shows legal notice before submit and readable controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEMO_PATH}?structured=1`);
    await page.locator("#form").scrollIntoViewIfNeeded();
    const notice = page.getByText("このフォームは、ご相談・お見積もりの受付フォームです。送信のみでは制作契約は成立しません。", { exact: true });
    const button = page.getByRole("button", { name: "相談内容を送信する" });
    const noticeBox = await notice.boundingBox();
    const buttonBox = await button.boundingBox();
    expect(noticeBox && buttonBox && noticeBox.y + noticeBox.height < buttonBox.y).toBeTruthy();
    await expect(button).toHaveCSS("background-color", "rgb(166, 50, 104)");
    await expect(page.getByRole("radio", { name: "まず相談したい" })).toHaveCSS("border-color", "rgb(166, 50, 104)");
    await page.screenshot({ path: test.info().outputPath("mobile-form.png"), fullPage: true });
  });

  test("keeps the legacy form as the default", async ({ page }) => {
    await page.goto(DEMO_PATH);

    await expect(page.getByRole("heading", { name: "ご希望・連絡先" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: "まず相談したい" })).toHaveCount(0);
    await expect(page.getByLabel("ご依頼の詳細")).toBeVisible();
    await submitMinimumRequest(page, "legacy");
  });

  test("submits the structured consultation flow without external writes", async ({ page }) => {
    await page.goto(`${DEMO_PATH}?structured=1`);

    await expect(page.getByRole("heading", { name: "ご希望・連絡先" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "まず相談したい" })).toBeChecked();
    await submitMinimumRequest(page, "consultation");
  });

  test("submits the structured quote flow without external writes", async ({ page }) => {
    await page.goto(`${DEMO_PATH}?structured=1`);

    await page.getByRole("radio", { name: "見積りを希望" }).check();
    await expect(page.getByRole("radio", { name: "見積りを希望" })).toBeChecked();
    await submitMinimumRequest(page, "quote");
  });
});
