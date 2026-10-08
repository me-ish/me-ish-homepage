import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { ENTRY_UPLOAD_BUCKET } from "../../src/lib/entryUpload";
import { observeStorage } from "./observe-storage";
import type { Check, TestContext } from "./test-context";

// Legacy gallery only. No Natori suite imports this module or its product code.
// Initialize before common Storage clients: the SDK captures the current fetch.
export async function createGallerySuite(origin: string) {
  const { POST } = await import("../../src/app/api/entry/upload/route");
  const observer = observeStorage(origin, ENTRY_UPLOAD_BUCKET);
  const { issueEntryUploadGrant } = await import("../../src/lib/server/entryUploadGrant");
  async function run(context: TestContext) {
    const { mode, serviceKey, anon, png, jpg, test, absent, content } = context;
    const check: Check = context.check;
    const keys = { service: serviceKey };
    let requestId = 0;
    async function api(
      body: object,
      extra: Record<string, string> = {},
      ip?: string,
    ) {
      // No HTTP server/test exception in product code. Exercise the real Request/POST/Response.
      return POST(
        new Request("http://localhost:3000/api/entry/upload", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-requested-with": "me-ish",
            origin: "http://localhost:3000",
            "x-forwarded-for": ip ?? `198.18.${Math.floor(++requestId / 254)}.${(requestId % 254) + 1}`,
            ...extra,
          },
          body: JSON.stringify(body),
        }),
      );
    }
    const hash = (bytes: Buffer) =>
      createHash("sha256").update(bytes).digest("hex");
    type Signed = {
      path: string;
      receipt: string;
      uploadToken: string;
      bucket: string;
    };
    async function sign(bytes = png, mimeType = "image/png"): Promise<Signed> {
      const r = await api({
        action: "sign",
        sizeBytes: bytes.length,
        mimeType,
        sha256: hash(bytes),
      });
      check(r.status === 200, `SIGN_HTTP_${r.status}`);
      check(r.headers.get("cache-control") === "no-store", "SIGN_CACHE");
      const data = (await r.json()) as Signed;
      check(
        data.bucket === ENTRY_UPLOAD_BUCKET &&
          /^pending\/entry_[\w-]+\.(png|jpg)$/.test(data.path),
        "GRANT_SCOPE",
      );
      return data;
    }
    async function put(s: Signed, bytes = png, mimeType = "image/png") {
      const r = await anon.storage
        .from(ENTRY_UPLOAD_BUCKET)
        .uploadToSignedUrl(s.path, s.uploadToken, bytes, {
          contentType: mimeType,
          upsert: false,
        });
      check(!r.error, "SIGNED_UPLOAD_FAILED");
    }
    async function finished(s: Signed, bytes = png) {
      const r = await api({ action: "finish", receipt: s.receipt });
      check(r.status === 200, `FINISH_HTTP_${r.status}`);
      const d = (await r.json()) as { fileName: string; publicUrl: string };
      check(d.fileName === s.path.slice("pending/".length), "FINISH_PATH");
      await content("artworks", d.fileName, bytes);
      return d;
    }
    await test("origin-and-csrf", async () => {
      const body = {
        action: "sign",
        sizeBytes: png.length,
        mimeType: "image/png",
        sha256: hash(png),
      };
      check(
        (await api(body, { "x-requested-with": "" })).status === 403,
        "CSRF_ALLOWED",
      );
      check(
        (await api(body, { origin: "https://attacker.invalid" })).status === 403,
        "CROSS_ORIGIN_ALLOWED",
      );
      check(
        (await api(body, { origin: "" })).status === 403,
        "MISSING_ORIGIN_ALLOWED",
      );
    });
    for (const [name, override] of Object.entries({
      path: { path: "existing.png" },
      bucket: { bucket: "natori-deliveries" },
      mime: { mimeType: "text/html" },
      size: { sizeBytes: 10485761 },
      hash: { sha256: "bad" },
    })) {
      await test(`invalid-sign-${name}`, async () => {
        const r = await api({
          action: "sign",
          sizeBytes: png.length,
          mimeType: "image/png",
          sha256: hash(png),
          ...override,
        });
        check(r.status === 400, "INVALID_GRANT_ALLOWED");
      });
    }
    await test("rate-limit", async () => {
      for (let n = 0; n < 6; n++) {
        const r = await api(
          {
            action: "sign",
            sizeBytes: png.length,
            mimeType: "image/png",
            sha256: hash(png),
          },
          {},
          "192.0.2.240",
        );
        check(r.status === (n === 5 ? 429 : 200), "RATE_LIMIT");
      }
    });
    await test("receipt-tamper-and-expiry", async () => {
      const s = await sign();
      const [p, sig] = s.receipt.split(".");
      const changed = Buffer.from(
        JSON.stringify({
          ...JSON.parse(Buffer.from(p, "base64url").toString()),
          fileName: "existing.png",
        }),
      ).toString("base64url");
      check(
        (await api({ action: "finish", receipt: `${changed}.${sig}` })).status ===
          400,
        "RECEIPT_TAMPER_ALLOWED",
      );
      const expired = issueEntryUploadGrant(
        { mimeType: "image/png", sizeBytes: png.length, sha256: hash(png) },
        keys.service,
        Date.now() - 3 * 3600000,
      );
      check(
        (await api({ action: "finish", receipt: expired.receipt })).status ===
          400,
        "EXPIRED_RECEIPT_ALLOWED",
      );
      await absent("artworks", s.path.slice(8));
    });
    await test("finish-before-upload", async () => {
      const s = await sign();
      check(
        (await api({ action: "finish", receipt: s.receipt })).status === 503,
        "MISSING_UPLOAD_ACCEPTED",
      );
      await absent("artworks", s.path.slice(8));
    });
    await test("staging-private-and-unsigned-write-denied", async () => {
      const s = await sign();
      await put(s);
      await content(ENTRY_UPLOAD_BUCKET, s.path, png);
      const publicRead = await fetch(
        `${origin}/storage/v1/object/public/${ENTRY_UPLOAD_BUCKET}/${s.path}`,
      );
      check(!publicRead.ok, "STAGING_PUBLIC");
      check(
        (await anon.storage.from(ENTRY_UPLOAD_BUCKET).download(s.path)).error,
        "STAGING_ANON_READ",
      );
      const path = `pending/unsigned-${randomUUID()}.png`;
      const raw = await anon.storage
        .from(ENTRY_UPLOAD_BUCKET)
        .upload(path, png, { contentType: "image/png" });
      check(
        raw.error && /row.level security/i.test(raw.error.message),
        "STAGING_ANON_WRITE",
      );
      await absent(ENTRY_UPLOAD_BUCKET, path);
    });
    await test("signed-scope-cannot-change-path", async () => {
      const s = await sign();
      const altered = s.path.replace("entry_", "other_");
      const r = await anon.storage
        .from(ENTRY_UPLOAD_BUCKET)
        .uploadToSignedUrl(altered, s.uploadToken, png, {
          contentType: "image/png",
        });
      check(
        r.error && /invalid signature/i.test(r.error.message),
        "SCOPE_BYPASS",
      );
      await absent(ENTRY_UPLOAD_BUCKET, altered);
    });
    await test("storage-enforces-size-and-mime", async () => {
      const s = await sign();
      const large = await anon.storage
        .from(ENTRY_UPLOAD_BUCKET)
        .uploadToSignedUrl(s.path, s.uploadToken, Buffer.alloc(10485761), {
          contentType: "image/png",
        });
      check(
        large.error && /size|large|maximum/i.test(large.error.message),
        "OVERSIZE_ALLOWED",
      );
      const wrong = await anon.storage
        .from(ENTRY_UPLOAD_BUCKET)
        .uploadToSignedUrl(s.path, s.uploadToken, png, {
          contentType: "text/html",
        });
      check(
        wrong.error && /mime|type/i.test(wrong.error.message),
        "MIME_ALLOWED",
      );
      await absent(ENTRY_UPLOAD_BUCKET, s.path);
    });
    for (const [name, bytes, mime] of [
      ["fake-image", Buffer.from("<html>not an image</html>"), "image/png"],
      [
        "small-image",
        await sharp({
          create: { width: 10, height: 10, channels: 3, background: "red" },
        })
          .png()
          .toBuffer(),
        "image/png",
      ],
      [
        "truncated-image",
        png.subarray(0, Math.floor(png.length / 2)),
        "image/png",
      ],
    ] as const) {
      await test(name, async () => {
        const s = await sign(bytes, mime);
        await put(s, bytes, mime);
        check(
          (await api({ action: "finish", receipt: s.receipt })).status === 400,
          "INVALID_IMAGE_PUBLISHED",
        );
        await absent("artworks", s.path.slice(8));
      });
    }
    await test("receipt-binds-bytes", async () => {
      const other = await sharp(png).negate().png().toBuffer();
      const s = await sign();
      await put(s, other);
      check(
        (await api({ action: "finish", receipt: s.receipt })).status === 400,
        "CHANGED_BYTES_ACCEPTED",
      );
      await absent("artworks", s.path.slice(8));
    });
    for (const [name, bytes, mime] of [
      ["png", png, "image/png"],
      ["jpeg", jpg, "image/jpeg"],
    ] as const) {
      await test(`publish-${name}-and-replay`, async () => {
        const s = await sign(bytes, mime);
        await put(s, bytes, mime);
        const one = await finished(s, bytes),
          two = await finished(s, bytes);
        check(one.publicUrl === two.publicUrl, "REPLAY_CHANGED_URL");
        const visible = await fetch(one.publicUrl);
        check(visible.ok, "PUBLIC_IMAGE_READ");
        check(
          Buffer.from(await visible.arrayBuffer()).equals(bytes),
          "PUBLIC_IMAGE_BYTES",
        );
        await absent(ENTRY_UPLOAD_BUCKET, s.path);
      });
    }
    await test("concurrent-finish", async () => {
      const s = await sign();
      await put(s);
      const observed = await observer.pair(() => finished(s), false);
      if (observed.results.some((r) => r.status === "rejected"))
        console.log(`DIAGNOSTIC phase0a/${mode}/concurrent-finish ${JSON.stringify(observed.events)}`);
      const [one, two] = observed.results;
      if (one.status === "rejected") throw one.reason;
      if (two.status === "rejected") throw two.reason;
      check(one.value.fileName === two.value.fileName, "CONCURRENT_TARGETS");
    });
    // A fixed, bounded sample, never "retry until green". Each pair uses a new
    // synthetic reservation. Preserve the first failure and wait for both actors.
    for (const synchronized of [false, true]) {
      await test(synchronized ? "concurrent-observed-synchronized" : "concurrent-observed-natural", async () => {
        const count = synchronized ? 48 : 96;
        for (let sample = 1; sample <= count; sample++) {
          const s = await sign();
          await put(s);
          const observed = await observer.pair(() => finished(s), synchronized);
          const failed = observed.results.find((r) => r.status === "rejected");
          if (failed) {
            console.log(`DIAGNOSTIC phase0a/${mode}/${synchronized ? "synchronized" : "natural"}/sample-${sample} ${JSON.stringify(observed.events)}`);
            if (failed.status === "rejected") throw failed.reason;
          }
          await content("artworks", s.path.slice("pending/".length), png);
          await absent(ENTRY_UPLOAD_BUCKET, s.path);
        }
        console.log(`SAMPLES phase0a/${mode}/${synchronized ? "synchronized" : "natural"}: ${count} pairs, both actors 200, bytes verified`);
      });
    }
  }
  return { run, restore: () => observer.restore() };
}
