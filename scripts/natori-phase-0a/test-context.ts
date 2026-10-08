import { readFileSync } from "node:fs";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

export type TestResult = { name: string; status: "passed" | "failed"; code?: string };
export type Check = (ok: unknown, code: string) => asserts ok;

// This file reads only the disposable runner's runtime files, never repo credentials.
export function loadRuntimeConfig(argument: string | undefined) {
  const mode = argument;
  if (mode !== "before" && mode !== "after")
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
  return { mode, origin, keys };
}

export async function createTestContext(
  runtime: ReturnType<typeof loadRuntimeConfig>,
  setSetupStage: (stage: string) => void,
) {
  const { mode, origin, keys } = runtime;
  setSetupStage("storage-clients");
  const admin = createClient(origin, keys.service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anon = createClient(origin, keys.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const results: TestResult[] = [];
  const check: Check = (ok, code) => {
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
  setSetupStage("synthetic-image");
  const png = await sharp({
    create: { width: 960, height: 960, channels: 3, background: "#287b74" },
  })
    .png()
    .toBuffer();
  const jpg = await sharp(png).jpeg().toBuffer();
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
  return { mode, origin, serviceKey: keys.service, admin, anon, png, jpg, results, test, check, absent, content };
}

export type TestContext = Awaited<ReturnType<typeof createTestContext>>;
