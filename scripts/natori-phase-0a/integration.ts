import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import { consultationUploadEndpoint } from "../../src/features/natori/lib/consultationUploadEndpoint";
import { ENTRY_UPLOAD_BUCKET } from "../../src/lib/entryUpload";
import { observeStorage } from "./observe-storage";

let setupStage = "runtime-config";
async function main() {
  const mode = process.argv[2];
  if (!["before", "after"].includes(mode))
    throw new Error("PHASE_0A_MODE_REQUIRED");
  const { origin } = JSON.parse(
    readFileSync("/runtime/network.json", "utf8"),
  ) as { origin: string };
  if (!/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin))
    throw new Error("DESTINATION_REJECTED");
  const keys = JSON.parse(
    readFileSync("/runtime/credentials.json", "utf8"),
  ) as { anon: string; service: string };
  process.env.NEXT_PUBLIC_SUPABASE_URL = origin;
  process.env.SUPABASE_SERVICE_ROLE_KEY = keys.service;
  setupStage = "load-server-module";
  const { POST } = await import("../../src/app/api/entry/upload/route");
  const observer = observeStorage(origin, ENTRY_UPLOAD_BUCKET);
  const { issueEntryUploadGrant } = await import(
    "../../src/lib/server/entryUploadGrant"
  );
  setupStage = "storage-clients";
  const admin = createClient(origin, keys.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(origin, keys.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const results: { name: string; status: string; code?: string }[] = [];
  const check: (ok: unknown, code: string) => asserts ok = (ok, code) => {
    if (!ok) throw new Error(code);
  };
  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, status: "passed" });
      console.log(`PASS phase0a/${mode}/${name}`);
    } catch (e) {
      const code =
        e instanceof Error && /^[A-Z_0-9]+$/.test(e.message)
          ? e.message
          : "UNEXPECTED_TEST_ERROR";
      results.push({ name, status: "failed", code });
      console.log(`FAIL phase0a/${mode}/${name} ${code}`);
    }
  }
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
  setupStage = "synthetic-image";
  const png = await sharp({
    create: { width: 960, height: 960, channels: 3, background: "#287b74" },
  })
    .png()
    .toBuffer();
  const jpg = await sharp(png).jpeg().toBuffer();
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
  async function absent(bucket: string, path: string) {
    const r = await admin.storage.from(bucket).info(path);
    check(
      r.error && /object not found/i.test(r.error.message),
      "EXPECTED_OBJECT_ABSENT",
    );
  }
  async function content(bucket: string, path: string, bytes: Buffer) {
    const r = await admin.storage.from(bucket).download(path);
    check(!r.error && r.data, "READBACK_FAILED");
    check(
      Buffer.from(await r.data.arrayBuffer()).equals(bytes),
      "READBACK_BYTES",
    );
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
  for (const bucket of ["aura-assets", "card-assets", "natori-portfolio"]) {
    await test(`remaining-bucket/${bucket}`, async () => {
      const path = `phase0a/${mode}-${randomUUID()}.png`;
      const insert = await anon.storage
        .from(bucket)
        .upload(path, png, { contentType: "image/png" });
      if (mode === "before") {
        check(!insert.error, "CURRENT_ANON_INSERT");
        await content(bucket, path, png);
      } else {
        check(
          insert.error && /row.level security/i.test(insert.error.message),
          "CANDIDATE_ANON_INSERT",
        );
        await absent(bucket, path);
      }
      const owned = `phase0a/service-${mode}-${randomUUID()}.png`;
      check(
        !(
          await admin.storage
            .from(bucket)
            .upload(owned, png, { contentType: "image/png" })
        ).error,
        "SERVICE_INSERT",
      );
      await content(bucket, owned, png);
      const publicRead = await fetch(
        `${origin}/storage/v1/object/public/${bucket}/${owned}`,
      );
      if (bucket === "natori-portfolio") {
        check(
          publicRead.ok &&
            Buffer.from(await publicRead.arrayBuffer()).equals(png),
          "PORTFOLIO_PUBLIC_BYTES",
        );
      } else {
        check(
          [400, 404].includes(publicRead.status),
          "PRIVATE_BUCKET_PUBLIC_READ",
        );
        const denied = await anon.storage.from(bucket).download(owned);
        // Storage deliberately masks private buckets from anon callers as 404.
        // The preceding service byte-read and following signed read prove that
        // this is an access boundary, not an absent bucket/file or failed network.
        // storage-js download uses noResolveJson and wraps the HTTP Response in
        // StorageUnknownError; inspect that response, not its generic message.
        const deniedResponse =
          denied.error && "originalError" in denied.error
            ? denied.error.originalError
            : null;
        check(deniedResponse instanceof Response, "PRIVATE_DENIAL_NOT_HTTP");
        const deniedBody = (await deniedResponse.json()) as {
          statusCode?: string;
          message?: string;
        };
        check(
          [400, 404].includes(deniedResponse.status) &&
            String(deniedBody.statusCode) === "404" &&
            /^(bucket|object) not found$/i.test(deniedBody.message ?? ""),
          "PRIVATE_BUCKET_ANON_READ",
        );
        const signed = await admin.storage
          .from(bucket)
          .createSignedUrl(owned, 60);
        check(signed.data && !signed.error, "PRIVATE_SIGN_READ");
        check(
          new URL(signed.data.signedUrl).origin === origin,
          "PRIVATE_SIGN_ORIGIN",
        );
        const visible = await fetch(signed.data.signedUrl);
        check(
          visible.ok && Buffer.from(await visible.arrayBuffer()).equals(png),
          "PRIVATE_SIGNED_BYTES",
        );
      }
      check(
        !(
          await admin.storage
            .from(bucket)
            .update(owned, jpg, { contentType: "image/jpeg" })
        ).error,
        "SERVICE_UPDATE",
      );
      await content(bucket, owned, jpg);
      check(
        !(await admin.storage.from(bucket).remove([owned])).error,
        "SERVICE_DELETE",
      );
      await absent(bucket, owned);
    });
  }
  for (const resume of [false, true])
    await test(
      resume ? "signed-tus-client-resume" : "signed-tus-client-large-file",
      async () => {
        const path = `phase0a/${mode}-${randomUUID()}.png`,
          bytes = Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)]);
        const signed = await admin.storage
          .from("natori-consultations")
          .createSignedUploadUrl(path, { upsert: false });
        check(signed.data && !signed.error, "TUS_SIGN");
        const token = signed.data.token;
        let resumedHead = false;
        await new Promise<void>((resolve, reject) => {
          let interrupted = false;
          const options: ConstructorParameters<typeof Upload>[1] = {
            endpoint: consultationUploadEndpoint(origin),
            headers: { "x-signature": token },
            metadata: {
              bucketName: "natori-consultations",
              objectName: path,
              contentType: "image/png",
            },
            chunkSize: 6 * 1024 * 1024,
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            retryDelays: [],
            // CLI advertises localhost in Location. Rebase ONLY this local gateway header,
            // never allow the test process to connect to that host or an external endpoint.
            onAfterResponse: (request, response) => {
              if (
                request.getMethod() === "HEAD" &&
                Number(response.getHeader("Upload-Offset")) >= 6 * 1024 * 1024
              )
                resumedHead = true;
              const get = response.getHeader.bind(response);
              response.getHeader = (name: string) => {
                const v = get(name);
                if (name.toLowerCase() !== "location" || !v) return v;
                const location = new URL(v, origin);
                if (
                  !location.pathname.startsWith(
                    "/storage/v1/upload/resumable/sign/",
                  )
                )
                  throw new Error("TUS_LOCATION_SCOPE");
                return `${origin}${location.pathname}`;
              };
            },
            onSuccess: () => resolve(),
            onError: () => reject(new Error("TUS_CLIENT_FAILED")),
          };
          const upload = new Upload(bytes, {
            ...options,
            onChunkComplete: (_chunk, accepted, total) => {
              if (resume && !interrupted && accepted < total) {
                interrupted = true;
                void upload
                  .abort()
                  .then(() => {
                    if (!upload.url) {
                      reject(new Error("TUS_RESUME_URL_MISSING"));
                      return;
                    }
                    new Upload(bytes, {
                      ...options,
                      uploadUrl: upload.url,
                    }).start();
                  })
                  .catch(() => reject(new Error("TUS_ABORT_FAILED")));
              }
            },
          });
          upload.start();
        });
        if (resume) check(resumedHead, "TUS_RESUME_OFFSET_NOT_PROVEN");
        await content("natori-consultations", path, bytes);
      },
    );
  const summary = {
    mode,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: 0,
    results,
  };
  observer.restore();
  writeFileSync(
    `/results/phase0a-${mode}.json`,
    JSON.stringify(summary, null, 2),
  );
  console.log(
    `SUMMARY phase0a/${mode}: passed=${summary.passed} failed=${summary.failed} skipped=0`,
  );
  if (summary.failed) process.exitCode = 1;
}
main().catch((error: unknown) => {
  // Locations and classifications only: never emit messages, request URLs or credentials.
  const e = error as { name?: string; code?: string; message?: string; stack?: string };
  console.error("PHASE_0A_SETUP_FAILED", setupStage, {
    type: /^[A-Za-z]+Error$/.test(e?.name ?? "") ? e.name : "Error",
    code: /^[A-Z_0-9]+$/.test(e?.code ?? "") ? e.code :
      /^(?:SIGN_HTTP_\d{3}|FINISH_HTTP_\d{3}|SIGNED_UPLOAD_FAILED|READBACK_FAILED|READBACK_BYTES|EXPECTED_OBJECT_ABSENT)$/.test(e?.message ?? "")
        ? e.message : "UNCLASSIFIED",
    locations: e?.stack?.match(/integration\.cjs:\d+:\d+/g)?.slice(0, 4),
  });
  process.exitCode = 1;
});
