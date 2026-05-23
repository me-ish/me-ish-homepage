import { createClient } from "@/lib/supabase/client";

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

const PROFILES_TABLE = "natori_user_profiles";

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

export async function fetchOwnNatoriProfile(): Promise<NatoriUserProfile | null> {
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToProfile(data as ProfileRow);
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
  const supabase = createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("ログインが必要です。");

  const payload = {
    user_id: user.id,
    handle: input.handle ?? null,
    display_name: input.displayName ?? null,
    portfolio_url: input.portfolioUrl ?? null,
    links_url: input.linksUrl ?? null,
    daily_capacity_hours: input.dailyCapacityHours ?? null,
  };

  const { data, error } = await supabase
    .from(PROFILES_TABLE)
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToProfile(data as ProfileRow);
}
