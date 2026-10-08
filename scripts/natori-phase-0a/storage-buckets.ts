import { randomUUID } from "node:crypto";
import type { Check, TestContext } from "./test-context";

// The caller owns the bucket list; this helper imports no gallery application code.
export async function runBucketTests(context: TestContext, buckets: readonly string[]) {
  const { mode, origin, admin, anon, png, jpg, test, absent, content } = context;
  const check: Check = context.check;
  for (const bucket of buckets) {
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
}
