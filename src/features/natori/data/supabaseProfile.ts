// natori プロフィールのデータアクセス。
// 認可（合言葉キー / ログイン）はサーバー側 API に任せるため、
// ブラウザ Supabase ではなく /api/natori/admin/profile を経由する。
import { z } from "zod";
import { NatoriEditConflictError } from "../lib/editConflict";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

export type NatoriUserProfile = {
  mutationRevision: number;
  userId: string;
  handle?: string;
  displayName?: string;
  portfolioUrl?: string;
  linksUrl?: string;
  dailyCapacityHours?: number;
};

const profileRowSchema = z.object({ user_id: z.uuid(), mutation_revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), handle: z.string().nullable(), display_name: z.string().nullable(), portfolio_url: z.string().nullable(), links_url: z.string().nullable(), daily_capacity_hours: z.number().nullable() });
type ProfileRow = z.infer<typeof profileRowSchema>;

const API_PATH = "/api/natori/admin/profile";

function rowToProfile(row: ProfileRow): NatoriUserProfile {
  return {
    userId: row.user_id,
    mutationRevision: row.mutation_revision,
    handle: row.handle ?? undefined,
    displayName: row.display_name ?? undefined,
    portfolioUrl: row.portfolio_url ?? undefined,
    linksUrl: row.links_url ?? undefined,
    dailyCapacityHours: row.daily_capacity_hours ?? undefined,
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${fallback} (${response.status})`;
}

export async function fetchOwnNatoriProfile(): Promise<NatoriUserProfile | null> {
  const response = await fetch(API_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "プロフィールの読み込みに失敗しました"));
  }
  const payload = (await response.json()) as { profile: ProfileRow | null };
  return payload.profile ? rowToProfile(profileRowSchema.parse(payload.profile)) : null;
}

export type NatoriUserProfileInput = {
  handle?: string | null;
  displayName?: string | null;
  portfolioUrl?: string | null;
  linksUrl?: string | null;
  dailyCapacityHours?: number | null;
};

export async function upsertOwnNatoriProfile(
  input: NatoriUserProfileInput,
  expectedRevision?: number | null
): Promise<NatoriUserProfile> {
  if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || (expectedRevision as number) < 0)) throw new Error("最新の保存済み内容を取得してください。");
  const response = await fetch(API_PATH, {
    method: "PUT",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRevision, patch: input }),
  });
  const payload = await response.json().catch(() => null) as { profile?: unknown; code?: string; error?: string } | null;
  if (response.status === 409 && payload?.code === "natori_edit_conflict") throw new NatoriEditConflictError();
  const parsed = profileRowSchema.safeParse(payload?.profile);
  if (!response.ok || !parsed.success) throw new Error(payload?.error ?? "プロフィールの保存結果を確認できません。");
  return rowToProfile(parsed.data);
}
