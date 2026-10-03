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
    await expect(page.getByText("用途・条件", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "送信前の確認" }).getByText("商用利用する", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "送信前の確認" }).getByText("完全非公開", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "見積もりを依頼する" }).click();
    await expect(page.getByRole("heading", { name: "送信ありがとうございます!" })).toBeVisible();
  });

  // PREPARED ONLY: insert inside the existing public intake describe block.
  // Inherits its non-GET write-blocking route. Demo UI proof does not prove an actual POST.
  for (const width of [1280, 360, 390]) {
    test(`Phase 5 padded option and named editing at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${DEMO_PATH}?structured=1`);
      await openInquiry(page, "見積もりをお願いしたい");
      const checkbox = page.getByRole("checkbox", { name: /表情を追加する（表情差分）/ });
      const cardLabel = page.locator("label").filter({ has: checkbox });
      const box = await cardLabel.boundingBox();
      if (!box) throw new Error("option card label is not visible");
      // Actual pointer coordinates inside the label's blank padding, outside checkbox/text.
      await cardLabel.click({ position: { x: box.width - 4, y: 4 } });
      await expect(checkbox).toBeChecked();
      await checkbox.focus();
      await page.keyboard.press("Space");
      await expect(checkbox).not.toBeChecked();
      await page.keyboard.press("Space");
      await expect(checkbox).toBeChecked();
      const quantity = page.getByLabel("追加する表情の数");
      await quantity.fill("2.5");
      await page.getByRole("button", { name: "条件・連絡先へ" }).click();
      await expect(quantity).toBeFocused();
      await expect(quantity).toHaveValue("2.5");
      await expect(quantity).toHaveAttribute("aria-invalid", "true");
      await quantity.fill("2");
      await page.getByRole("button", { name: "条件・連絡先へ" }).click();
      await fillContact(page, `phase5-${width}`);
      await page.getByLabel("商用利用").selectOption("yes");
      await page.getByLabel(/作品の公開可否/).selectOption("fully_private");
      await page.getByRole("button", { name: "内容を確認する" }).click();
      const confirmation = page.getByRole("region", { name: "送信前の確認" });
      await expect(confirmation).toContainText("表情差分 ×2");
      await expect(confirmation).toContainText("商用利用する");
      await expect(confirmation).toContainText("完全非公開");
      const edit = confirmation.getByRole("button", { name: "用途・条件を修正する" });
      const editBox = await edit.boundingBox();
      if (!editBox) throw new Error("named edit button is not visible");
      expect(editBox.width).toBeGreaterThanOrEqual(44);
      expect(editBox.height).toBeGreaterThanOrEqual(44);
      await edit.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "ご希望の条件と連絡先" })).toBeFocused();
      await expect(page.getByLabel("商用利用")).toHaveValue("yes");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`phase5-${width}.png`), fullPage: true });
    });
  }

  test("Phase 5 reference overflow names omitted files and focuses the existing URL field", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEMO_PATH}?structured=1`);
    await openInquiry(page, "見積もりをお願いしたい");
    const materials = page.locator("summary").filter({ hasText: /^資料/ }).locator("..");
    await materials.locator("summary").first().click();
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWN44zHzPwwzIHMA2KQQyVXgEtIAAAAASUVORK5CYII=", "base64");
    await page.getByLabel("キャラクター資料の画像を選択").setInputFiles(Array.from({ length: 6 }, (_, index) => ({ name: `reference-${index + 1}.png`, mimeType: "image/png", buffer: png })));
    await expect(page.getByText(/5枚を追加しました。枚数制限のため1枚は追加していません/)).toBeVisible();
    await expect(page.getByText(/参考URLに共有リンクを貼ってください/)).toBeVisible();
    await expect(materials.getByRole("img")).toHaveCount(5);
    await page.getByRole("button", { name: "参考URL欄へ移動する" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("参考URL 1", { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test("Phase 5 all named edit targets preserve reviewed values and hidden Other answers are pruned", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 844 });
    await page.goto(`${DEMO_PATH}?structured=1`);
    await openInquiry(page, "見積もりをお願いしたい");
    await page.getByLabel("ご依頼の種類", { exact: true }).selectOption("other");
    await page.getByLabel(/ご依頼の種類（その他の内容）/).fill("イベント表紙");
    await page.getByRole("checkbox", { name: /表情を追加する（表情差分）/ }).check();
    await page.getByLabel("追加する表情の数").fill("2");
    await page.getByLabel("補足（任意）", { exact: true }).fill("笑顔・泣き顔");
    const details = page.locator("summary").filter({ hasText: /^キャラクター・イメージの詳細を入力する/ }).locator("..");
    await details.locator("summary").first().click();
    await page.getByLabel("キャラクターの特徴").fill("水色の髪");
    const materials = page.locator("summary").filter({ hasText: /^資料/ }).locator("..");
    await materials.locator("summary").first().click();
    await page.getByLabel("参考URL 1", { exact: true }).fill("https://example.com/reference");
    await page.getByLabel("このURLの内容（任意）").fill("衣装の設定資料");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAYAAACddGYaAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWN44zHzPwwzIHMA2KQQyVXgEtIAAAAASUVORK5CYII=", "base64");
    await page.getByLabel("キャラクター資料の画像を選択").setInputFiles({ name: "costume.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "条件・連絡先へ" }).click();
    await fillContact(page, "phase5-edit");
    await page.getByLabel("商用利用", { exact: true }).selectOption("yes");
    await page.getByLabel(/作品の公開可否/).selectOption("delayed");
    await page.getByLabel(/公開可能日/).fill("2026-11-15");
    await page.getByRole("button", { name: "内容を確認する" }).click();
    const confirmation = page.getByRole("region", { name: "送信前の確認" });
    for (const text of ["イベント表紙", "表情差分 ×2（笑顔・泣き顔）", "水色の髪", "商用利用する", "2026年11月15日", "衣装の設定資料", "example.com", "costume.png"]) await expect(confirmation).toContainText(text);
    await expect(confirmation.getByRole("img", { name: "確認用の添付画像 1" })).toBeVisible();
    const edits = confirmation.getByRole("button", { name: /を修正する$/ });
    expect(await edits.count()).toBeGreaterThanOrEqual(5);
    for (const edit of await edits.all()) {
      const box = await edit.boundingBox();
      if (!box) throw new Error("named edit target is missing");
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await confirmation.getByRole("button", { name: "資料を修正する" }).click();
    await expect(page.getByLabel("参考URL 1", { exact: true })).toBeVisible();
    await expect(page.getByLabel("参考URL 1", { exact: true })).toHaveValue("https://example.com/reference");
    await page.getByLabel("ご依頼の種類", { exact: true }).selectOption("illustration", { timeout: 5000 });
    await expect(page.getByLabel(/ご依頼の種類（その他の内容）/)).toHaveCount(0);
    await page.getByRole("button", { name: "条件・連絡先へ" }).click();
    await page.getByRole("button", { name: "内容を確認する" }).click();
    await expect(confirmation).not.toContainText("イベント表紙");
    await expect(confirmation).toContainText("一枚絵");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath("phase5-review-360.png"), fullPage: true });
  });

  test("Phase 5 pricing origin re-presents the selected drawing range", async ({ page }) => {
    await page.goto(`${DEMO_PATH}?structured=1`);
    const plan = page.locator("#pricing a").filter({ hasText: "このプランで相談" }).first();
    const href = await plan.getAttribute("href");
    if (!href) throw new Error("pricing plan has no link");
    const url = new URL(href, page.url());
    const selected = url.searchParams.get("plan");
    url.searchParams.set("structured", "1");
    await page.goto(url.toString());
    const labels: Record<string, string> = { bust_up: "胸上", waist_up: "膝〜腰上", full_body: "全身", sd: "SDキャラクター" };
    if (!selected || !labels[selected]) throw new Error("unexpected pricing plan fixture");
    await expect(page.getByText(/料金から選んだ内容：/)).toContainText(labels[selected]);
    const input = page.getByLabel(selected === "sd" ? "ご依頼の種類" : "制作範囲", { exact: true });
    await expect(input).toHaveValue(selected);
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
