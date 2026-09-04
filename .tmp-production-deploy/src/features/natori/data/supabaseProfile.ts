// natori プロフィールのデータアクセス。
// 認可（合言葉キー / ログイン）はサーバー側 API に任せるため、
// ブラウザ Supabase ではなく /api/natori/admin/profile を経由する。
import { CSRF_HEADERS } from "@/lib/auth/csrf";

export type NatoriUserProfile = {
  userId: string;
  handle?: string;
  displayName?: string;
  portfolioUrl?: string;
  linksUrl?: string;
  dailyCapacityHours?: number;
};

type ProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  portfolio_url: string | null;
  links_url: string | null;
  daily_capacity_hours: number | null;
};

const API_PATH = "/api/natori/admin/profile";

function rowToProfile(row: ProfileRow): NatoriUserProfile {
  return {
    userId: row.user_id,
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
  return payload.profile ? rowToProfile(payload.profile) : null;
}

export type NatoriUserProfileInput = {
  handle?: string | null;
  displayName?: string | null;
  portfolioUrl?: string | null;
  linksUrl?: string | null;
  dailyCapacityHours?: number | null;
};

export async function upsertOwnNatoriProfile(
  input: NatoriUserProfileInput
): Promise<NatoriUserProfile> {
  const response = await fetch(API_PATH, {
    method: "PUT",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "プロフィールの保存に失敗しました"));
  }
  const payload = (await response.json()) as { profile: ProfileRow };
  return rowToProfile(payload.profile);
}
