import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type NatoriAdminProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string | null;
  portfolio_url: string | null;
  links_url: string | null;
  daily_capacity_hours: number | null;
};

const PROFILES_TABLE = "natori_user_profiles";

export type GetNatoriProfileResult =
  | { kind: "ok"; profile: NatoriAdminProfileRow | null }
  | { kind: "db-error" };

export async function getNatoriAdminProfile(userId: string): Promise<GetNatoriProfileResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(PROFILES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[natori-admin-profile] fetch failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", profile: (data ?? null) as NatoriAdminProfileRow | null };
}

export type UpsertNatoriProfileResult =
  | { kind: "ok"; profile: NatoriAdminProfileRow }
  | { kind: "db-error" };

export async function upsertNatoriAdminProfile(input: {
  userId: string;
  handle: string | null;
  displayName: string | null;
  portfolioUrl: string | null;
  linksUrl: string | null;
  dailyCapacityHours: number | null;
}): Promise<UpsertNatoriProfileResult> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from(PROFILES_TABLE)
    .upsert(
      {
        user_id: input.userId,
        handle: input.handle,
        display_name: input.displayName,
        portfolio_url: input.portfolioUrl,
        links_url: input.linksUrl,
        daily_capacity_hours: input.dailyCapacityHours,
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();
  if (error) {
    console.error("[natori-admin-profile] upsert failed", error);
    return { kind: "db-error" };
  }
  return { kind: "ok", profile: data as NatoriAdminProfileRow };
}
