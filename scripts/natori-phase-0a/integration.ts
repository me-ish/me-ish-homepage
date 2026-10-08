import { writeFileSync } from "node:fs";
import { createTestContext, loadRuntimeConfig } from "./test-context";
import { assertCaseInventory } from "./suite-manifest.mjs";

let setupStage = "runtime-config";
async function main() {
  const runtime = loadRuntimeConfig(process.argv[2]);
  // Separate bundles keep the Natori runner independent. Every suite is mandatory.
  // build.mjs maps these imports to sibling .cjs files in the same read-only mount.
  setupStage = "load-server-module";
  const { createGallerySuite } = await import("./gallery-suite");
  const gallery = await createGallerySuite(runtime.origin);
  try {
    const context = await createTestContext(runtime, (stage) => { setupStage = stage; });
    const { mode, results } = context;
    setupStage = "gallery-suite";
    await gallery.run(context);
    setupStage = "legacy-assets-suite";
    const { runLegacyAssetTests } = await import("./legacy-assets-suite");
    await runLegacyAssetTests(context);
    setupStage = "natori-suite";
    const { runNatoriTests } = await import("./natori-suite");
    await runNatoriTests(context);
    setupStage = "case-inventory";
    assertCaseInventory(results);
    const summary = {
      mode,
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
      skipped: 0,
      results,
    };
    writeFileSync(
      `/results/phase0a-${mode}.json`,
      JSON.stringify(summary, null, 2),
    );
    console.log(
      `SUMMARY phase0a/${mode}: passed=${summary.passed} failed=${summary.failed} skipped=0`,
    );
    if (summary.failed) process.exitCode = 1;
  } finally {
    gallery.restore();
  }
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
