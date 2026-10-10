import { build } from "esbuild";
import { dirname, join, resolve } from "node:path";
if (!process.argv[2]) throw new Error("Output file required");

const output = process.argv[2];
const suites = ["gallery-suite", "legacy-assets-suite", "natori-suite"];
const options = {
  platform: "node",
  target: "node22",
  format: "cjs",
  bundle: true,
  packages: "bundle",
  external: ["sharp"],
  alias: { "server-only": resolve("scripts/natori-phase-0a/server-only.mjs") },
  metafile: true,
};

// Check the actual transitive graph, not a filename-only promise. The Natori
// suite's sole application dependency is its existing TUS endpoint helper.
function assertProductBoundary(name, inputs) {
  if (name === "gallery-suite") return;
  const allowed = name === "natori-suite"
    ? new Set(["src/features/natori/lib/consultationUploadEndpoint.ts"])
    : new Set();
  if (Object.keys(inputs).some((path) => path.startsWith("src/") && !allowed.has(path))) {
    throw new Error("PHASE_0A_PRODUCT_DEPENDENCY_BOUNDARY");
  }
  console.log(`PASS phase0a-bundle/${name}: no legacy application dependency`);
}

for (const name of suites) {
  const result = await build({
    ...options,
    entryPoints: [`scripts/natori-phase-0a/${name}.ts`],
    outfile: join(dirname(output), `${name}.cjs`),
  });
  assertProductBoundary(name, result.metafile.inputs);
}

const result = await build({
  ...options,
  entryPoints: ["scripts/natori-phase-0a/integration.ts"],
  outfile: output,
  plugins: [{
    name: "phase0a-independent-suites",
    setup(builder) {
      builder.onResolve({ filter: /^\.\/(gallery-suite|legacy-assets-suite|natori-suite)$/ }, (args) => ({
        path: `${args.path}.cjs`,
        external: true,
      }));
    },
  }],
});
assertProductBoundary("integration", result.metafile.inputs);
