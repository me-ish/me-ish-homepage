// Derived from the exact guarded Phase 5 e2e addition; six logical UI cases retained.
export function registerPhase5Cases({test,expect,DEMO_PATH,openInquiry,fillContact,assertActualEnvelope,prepareActualEnvelope,checkpoint=()=>{}}){
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
      if (width === 390) await prepareActualEnvelope(page);
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
      if (width === 390) await assertActualEnvelope(page);
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
    checkpoint('EDIT_INPUTS');
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
    checkpoint('EDIT_CONDITIONS');
    await fillContact(page, "phase5-edit");
    await page.getByLabel("商用利用", { exact: true }).selectOption("yes");
    await page.getByLabel(/作品の公開可否/).selectOption("delayed");
    await page.getByLabel(/公開可能日/).fill("2026-11-15");
    await page.getByRole("button", { name: "内容を確認する" }).click();
    const confirmation = page.getByRole("region", { name: "送信前の確認" });
    checkpoint('EDIT_REVIEW_VALUES');
    for (const text of ["イベント表紙", "表情差分 ×2（笑顔・泣き顔）", "水色の髪", "商用利用する", "2026年11月15日", "衣装の設定資料", "example.com", "costume.png"]) await expect(confirmation).toContainText(text);
    checkpoint('EDIT_REVIEW_IMAGE');
    await expect(confirmation.getByRole("img", { name: "確認用の添付画像 1" })).toBeVisible();
    checkpoint('EDIT_TARGET_COUNT');
    const edits = confirmation.getByRole("button", { name: /を修正する$/ });
    expect(await edits.count()).toBeGreaterThanOrEqual(5);
    checkpoint('EDIT_TARGET_GEOMETRY');
    for (const edit of await edits.all()) {
      const box = await edit.boundingBox();
      if (!box) throw new Error("named edit target is missing");
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    checkpoint('EDIT_MATERIALS');
    await confirmation.getByRole("button", { name: "資料を修正する" }).click();
    await expect(page.getByLabel("参考URL 1", { exact: true })).toBeVisible();
    await expect(page.getByLabel("参考URL 1", { exact: true })).toHaveValue("https://example.com/reference");
    const requestType = page.getByLabel("ご依頼の種類", { exact: true });
    await checkpoint('SELECT_TYPE', requestType);
    await expect(requestType.locator('option[value="icon"]')).toHaveCount(0);
    await expect(requestType.locator('option[value="illustration"]')).toHaveCount(1);
    await expect(requestType).toBeVisible();
    await expect(requestType).toBeEnabled();
    await requestType.selectOption("illustration", { timeout: 5000 });
    await checkpoint('OTHER_GONE', page.getByLabel(/ご依頼の種類（その他の内容）/));
    await expect(page.getByLabel(/ご依頼の種類（その他の内容）/)).toHaveCount(0);
    const conditionsNext = page.getByRole("button", { name: "条件・連絡先へ" });
    await checkpoint('NEXT_CONDITIONS', conditionsNext);
    await conditionsNext.click();
    const reviewNext = page.getByRole("button", { name: "内容を確認する" });
    await checkpoint('NEXT_REVIEW', reviewNext);
    await reviewNext.click();
    checkpoint('EDIT_FINAL_REVIEW');
    await expect(confirmation).not.toContainText("イベント表紙");
    await expect(confirmation).toContainText("一枚絵");
    checkpoint('EDIT_OVERFLOW');
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
    const labels = { bust_up: "胸上", waist_up: "膝〜腰上", full_body: "全身", sd: "SDキャラクター" };
    if (!selected || !labels[selected]) throw new Error("unexpected pricing plan fixture");
    await expect(page.getByText(/料金から選んだ内容：/)).toContainText(labels[selected]);
    const input = page.getByLabel(selected === "sd" ? "ご依頼の種類" : "制作範囲", { exact: true });
    await expect(input).toHaveValue(selected);
  });

}
