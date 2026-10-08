import type { TestContext } from "./test-context";
import { runBucketTests } from "./storage-buckets";

export async function runLegacyAssetTests(context: TestContext) {
  await runBucketTests(context, ["aura-assets", "card-assets"]);
}
