// features/natori/lib/linksContent.ts
// NatoriLinksContent の検証・正規化（DB非依存の純関数）。
import { z } from "zod";
import type { NatoriLinksContent } from "@/features/natori/types/links";

const linkItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().max(100),
  sub: z.string().max(200),
  href: z.string().max(1000),
});

export const natoriLinksContentSchema = z.object({
  links: z.array(linkItemSchema).max(30),
});

/** unknown な値（DB由来など）を検証して NatoriLinksContent に。失敗時は null */
export function parseNatoriLinksContent(value: unknown): NatoriLinksContent | null {
  const result = natoriLinksContentSchema.safeParse(value);
  return result.success ? result.data : null;
}
