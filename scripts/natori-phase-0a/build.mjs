import { build } from "esbuild";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
if (!process.argv[2]) throw new Error("Output file required");
await build({
  entryPoints: ["scripts/natori-phase-0a/integration.ts"],
  outfile: process.argv[2],
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  packages: "bundle",
  external: ["sharp"],
  alias: { "server-only": resolve("scripts/natori-phase-0a/server-only.mjs") },
  // Optional negative control: exact reviewed pre-fix service, in a disposable
  // bundle only. The candidate bundle always uses the real current product.
  plugins: process.argv[3] ? [{
    name: "reviewed-baseline-service",
    setup(builder) {
      builder.onLoad({filter: /[/\\]entryUploadService\.ts$/}, () => ({
        contents: readFileSync(process.argv[3], "utf8"), loader: "ts",
        resolveDir: resolve("src/lib/server"),
      }));
    },
  }] : [],
});
