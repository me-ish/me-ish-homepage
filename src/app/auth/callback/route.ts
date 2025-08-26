import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

const allowed = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "info@me-ish.art")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  if (code) {
    // code をセッションに交換（Cookieへ保存）
    await supabase.auth.exchangeCodeForSession(code);
  }

  const { data: { user } } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? null;

  if (email && allowed.includes(email)) {
    return NextResponse.redirect(`${url.origin}/admin`);
  } else {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${url.origin}/admin-login?err=unauthorized`);
  }
}
