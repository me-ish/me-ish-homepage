import { expect, test } from "@playwright/test";
import sharp from "sharp";

for (const rejected of [false, true]) {
  test(`gallery entry signed upload ${rejected ? "failure on mobile" : "success"}`, async ({
    page,
  }) => {
    if (rejected) await page.setViewportSize({ width: 390, height: 844 });
    const requests: string[] = [];
    const rows: Record<string, unknown>[] = [];
    const alerts: string[] = [];
    page.on("dialog", async (d) => {
      alerts.push(d.message());
      await d.dismiss();
    });
    // All writes are mocked; this browser test never contacts production or sends mail.
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.pathname === "/api/entry/upload") {
        const body = req.postDataJSON();
        requests.push(body.action);
        if (body.action === "sign")
          return json({
            bucket: "gallery-entry-intake",
            path: "pending/entry_synthetic.png",
            uploadToken: "synthetic",
            receipt: "synthetic.receipt",
          });
        return rejected
          ? json({ error: "画像の保存を確認できませんでした" }, 503)
          : json({
              fileName: "entry_synthetic.png",
              publicUrl:
                "http://127.0.0.1:54321/storage/v1/object/public/artworks/entry_synthetic.png",
            });
      }
      if (url.port === "54321") {
        if (
          url.pathname.includes(
            "/storage/v1/object/upload/sign/gallery-entry-intake/",
          )
        ) {
          requests.push("signed-storage");
          return json({
            Key: "gallery-entry-intake/pending/entry_synthetic.png",
          });
        }
        if (url.pathname === "/rest/v1/entries" && req.method() === "POST") {
          rows.push(...req.postDataJSON());
          requests.push("entry");
          return json([], 201);
        }
        return json({});
      }
      if (!["localhost", "127.0.0.1"].includes(url.hostname))
        return route.abort();
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method()))
        return route.abort();
      return route.continue();
    });
    await page.goto("/ja/entry");
    await page.locator('[name="artistName"]').fill("Phase 0A synthetic artist");
    await page.locator('[name="email"]').fill("phase0a@example.invalid");
    await page.getByRole("button", { name: "次へ" }).click();
    const png = await sharp({
      create: { width: 960, height: 960, channels: 3, background: "#287b74" },
    })
      .png()
      .toBuffer();
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: "synthetic.png",
        mimeType: "image/png",
        buffer: png,
      });
    await page.locator('[name="title"]').fill("Phase 0A synthetic work");
    await page.locator('[name="has_signature"][value="no"]').check();
    await page.locator('[name="ai_usage"][value="none"]').check();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.locator('[name="isForSale"][value="no"]').check();
    await page
      .getByLabel("利用規約の要点（スクロールして全文確認）")
      .evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect(page.locator('[name="agreeTerms"]')).toBeEnabled();
    for (const name of [
      "agreeTerms",
      "confirmRights",
      "confirmOriginal",
      "confirmAge",
    ])
      await page.locator(`[name="${name}"]`).check();
    await page.getByRole("button", { name: "次へ" }).click();
    await page.getByRole("button", { name: "送信する", exact: true }).click();
    if (rejected) {
      await expect.poll(() => alerts.length).toBe(1);
      expect(alerts[0]).toContain("画像の保存を確認できませんでした");
      expect(rows).toEqual([]);
      await expect(
        page.getByRole("button", { name: "送信する", exact: true }),
      ).toBeEnabled();
    } else {
      await expect(
        page.getByRole("heading", { name: "送信完了！" }),
      ).toBeVisible();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        file_name: "entry_synthetic.png",
        image_url:
          "http://127.0.0.1:54321/storage/v1/object/public/artworks/entry_synthetic.png",
      });
    }
    expect(requests).toEqual(
      rejected
        ? ["sign", "signed-storage", "finish"]
        : ["sign", "signed-storage", "finish", "entry"],
    );
  });
}
