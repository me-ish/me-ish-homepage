// api/natori/admin/logout/route.ts
// 管理画面から出る。共有鍵の Cookie（natori_dashboard_key）を消し、Supabase のセッションも終える。
// 共有鍵は中身を見ずに消すだけなので、認可は要らない（消しても誰も得をしない）。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { NATORI_KEY_COOKIE } from "@/features/natori/constants/dashboardKey";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  let authSignedOut = true;
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signOut();
    if (error) authSignedOut = false;
  } catch {
    authSignedOut = false;
  }
  const response = NextResponse.json({ ok: true, authSignedOut }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set({ name: NATORI_KEY_COOKIE, value: "", httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
