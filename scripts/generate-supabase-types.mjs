import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PRODUCTION_PROJECT_REF = "lvnfspyainrxtztjytbo";
const OUTPUT_PATH = path.join("src", "types", "supabase.ts");
const supabaseArgs = [
  "supabase",
  "gen",
  "types",
  "typescript",
  "--project-id",
  PRODUCTION_PROJECT_REF,
  "--schema",
  "public",
];

const isWindows = process.platform === "win32";
const command = isWindows ? process.env.ComSpec || "cmd.exe" : "npx";
const args = isWindows
  ? ["/d", "/s", "/c", `npx ${supabaseArgs.join(" ")}`]
  : supabaseArgs;

const generated = execFileSync(command, args, {
  cwd: process.cwd(),
  encoding: "utf8",
  env: process.env,
  maxBuffer: 32 * 1024 * 1024,
});

if (!generated.includes("export type Database")) {
  throw new Error("Supabase type generation returned an unexpected result.");
}

writeFileSync(
  OUTPUT_PATH,
  generated.endsWith("\n") ? generated : `${generated}\n`,
  "utf8",
);
console.log(
  `Generated ${OUTPUT_PATH} from Supabase project ${PRODUCTION_PROJECT_REF}.`,
);
