import { redirect } from "next/navigation";
import { isAdminEmailAsync } from "@/lib/isAdmin";
import { supabaseServer } from "@/lib/supabaseServer";

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
