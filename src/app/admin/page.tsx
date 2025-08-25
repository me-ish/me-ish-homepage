import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import AdminClient from "./_components/AdminClient";

const allowedEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "info@me-ish.art")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export default async function AdminPage() {
  const supabase = await supabaseServer();

  // サーバーでユーザー取得（Cookieベースで安全）
  const { data: { user }, error } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase() ?? null;
  if (error || !email || !allowedEmails.includes(email)) {
    redirect("/admin-login"); // 非管理者はログイン画面へ
  }

  // 初期表示用の件数はサーバーで取って渡す（RLSに従う）
  const [{ count: newEntryCount }, { count: newInquiryCount }] = await Promise.all([
    supabase.from("entries").select("*", { count: "exact", head: true }).eq("confirmed", false),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_read", false),
  ]);

  return (
    <AdminClient
      adminEmail={email}
      initialNewEntryCount={newEntryCount ?? 0}
      initialNewInquiryCount={newInquiryCount ?? 0}
    />
  );
}
