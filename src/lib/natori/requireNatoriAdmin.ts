import { redirect } from "next/navigation";
import { isAdminEmailAsync } from "@/lib/isAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

function getNatoriStaffEmails(): Set<string> {
  const raw = [
    process.env.NATORI_STAFF_EMAILS,
    process.env.NATORI_OWNER_EMAILS,
  ]
    .filter(Boolean)
    .join(",");

  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function canAccessNatoriManagement(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (await isAdminEmailAsync(email)) return true;
  return getNatoriStaffEmails().has(email.toLowerCase());
}

export async function requireNatoriAdmin(nextPath: string): Promise<void> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  if (!email || !(await isAdminEmailAsync(email))) {
    redirect(`/admin-login?err=unauthorized&next=${encodeURIComponent(nextPath)}`);
  }
}

export async function requireNatoriAccess(nextPath: string): Promise<void> {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? null;

  if (!(await canAccessNatoriManagement(email))) {
    redirect(`/admin-login?err=unauthorized&next=${encodeURIComponent(nextPath)}`);
  }
}
