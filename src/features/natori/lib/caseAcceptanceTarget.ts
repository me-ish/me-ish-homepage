import { z } from "zod";

export const PRODUCTION_SUPABASE_REF = "lvnfspyainrxtztjytbo";
export const PRODUCTION_VERCEL_PROJECT = "prj_kmLUjzMOcRofMAVsNL2O97Q3GQRj";
const targetSchema = z.strictObject({
  profile: z.enum(["local", "hosted"]),
  ref: z.string(),
  project: z.string().min(1),
  url: z.string(),
  origin: z.string(),
  run: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});
export type CaseAcceptanceTarget = z.infer<typeof targetSchema>;
export function isLoopbackUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return (
      u.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      u.pathname === "/" &&
      !u.search &&
      !u.hash
    );
  } catch {
    return false;
  }
}
export function parseCaseAcceptanceTarget(
  raw: string,
  publicUrl: string,
  now = Date.now(),
  observe = false,
): CaseAcceptanceTarget {
  const t = targetSchema.parse(JSON.parse(raw)),
    u = new URL(t.url),
    origin = new URL(t.origin);
  if (
    u.href !== new URL(publicUrl).href ||
    u.username ||
    u.password ||
    u.pathname !== "/" ||
    u.search ||
    u.hash ||
    origin.origin !== t.origin ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    t.ref === PRODUCTION_SUPABASE_REF ||
    t.project === PRODUCTION_VERCEL_PROJECT ||
    t.url.includes(PRODUCTION_SUPABASE_REF) ||
    /(^|\.)me-ish\.art$/i.test(origin.hostname) ||
    (!observe &&
      (Date.parse(t.startsAt) > now || Date.parse(t.endsAt) <= now)) ||
    Date.parse(t.endsAt) <= Date.parse(t.startsAt)
  )
    throw Error("acceptance_target_invalid");
  if (t.profile === "hosted") {
    if (
      !/^[a-z]{20}$/.test(t.ref) ||
      u.origin !== `https://${t.ref}.supabase.co` ||
      u.port ||
      !/^prj_[A-Za-z0-9]+$/.test(t.project) ||
      origin.protocol !== "https:" ||
      origin.port ||
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    )
      throw Error("acceptance_target_invalid");
  } else if (
    t.ref !== "local" ||
    t.project !== "local-fixture" ||
    !isLoopbackUrl(t.url) ||
    !isLoopbackUrl(t.origin)
  )
    throw Error("acceptance_target_invalid");
  return t;
}
