import { randomUUID } from "node:crypto";
import { Upload } from "tus-js-client";
import { consultationUploadEndpoint } from "../../src/features/natori/lib/consultationUploadEndpoint";
import type { Check, TestContext } from "./test-context";
import { runBucketTests } from "./storage-buckets";

// Independently bundled: no old-gallery application imports, even transitively.
export async function runNatoriTests(context: TestContext) {
  const { mode, origin, admin, png, test, content } = context;
  const check: Check = context.check;
  await runBucketTests(context, ["natori-portfolio"]);
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
}
