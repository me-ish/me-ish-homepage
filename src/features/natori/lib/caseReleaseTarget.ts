import { z } from "zod";

const targetSchema = z.strictObject({
  profile: z.literal("production"),
  ref: z.string().regex(/^[a-z]{20}$/),
  project: z.string().regex(/^prj_[A-Za-z0-9]+$/),
  origin: z.string().max(255),
  owner: z.uuid(),
});
export type CaseReleaseTarget = z.infer<typeof targetSchema>;

/** Explicit deployment metadata, never a credential or an authorization grant. */
export function parseCaseReleaseTarget(raw: string, observed: {
  nodeEnv?: string; vercelEnv?: string; project?: string; owner?: string;
  serverUrl?: string; publicUrl?: string; siteUrl?: string;
}): CaseReleaseTarget {
  const t = targetSchema.parse(JSON.parse(raw));
  const origin = new URL(t.origin);
  const database = `https://${t.ref}.supabase.co`;
  const exactDatabase = (value?: string) => value === database || value === `${database}/`;
  if (observed.nodeEnv !== "production" || observed.vercelEnv !== "production"
    || observed.project !== t.project || observed.owner !== t.owner
    || !exactDatabase(observed.serverUrl) || !exactDatabase(observed.publicUrl)
    || origin.origin !== t.origin || origin.protocol !== "https:" || origin.port
    || origin.username || origin.password || origin.search || origin.hash
    || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(origin.hostname)
    || /(?:^|\.)localhost$/i.test(origin.hostname) || /^[\d.]+$/.test(origin.hostname)
    || (observed.siteUrl !== t.origin && observed.siteUrl !== `${t.origin}/`)) {
    throw Error("case_release_target_invalid");
  }
  return t;
}
