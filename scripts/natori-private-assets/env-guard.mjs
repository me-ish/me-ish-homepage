import { readdirSync } from "node:fs";
/** Inspect names only. Never open, follow, rename or delete an environment file. */
export function assertNoEnvFiles(directory) {
  const names = readdirSync(directory).filter((name) =>
    name.startsWith(".env"),
  );
  if (names.length)
    throw new Error(
      "Environment files present; use a clean checkout without .env*: " +
        names.join(", "),
    );
}
