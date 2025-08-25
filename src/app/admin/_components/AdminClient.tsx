"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Props = {
  adminEmail: string;
  initialNewEntryCount: number;
  initialNewInquiryCount: number;
};

export default function AdminClient({
  adminEmail,
  initialNewEntryCount,
  initialNewInquiryCount,
}: Props) {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const [newEntryCount, setNewEntryCount] = useState(initialNewEntryCount);
  const [newInquiryCount, setNewInquiryCount] = useState(initialNewInquiryCount);

  // 必要ならマウント後に最新値へ更新
  useEffect(() => {
    (async () => {
      const [entriesRes, inquiriesRes] = await Promise.all([
        supabase.from("entries").select("*", { count: "exact", head: true }).eq("confirmed", false),
        supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_read", false),
      ]);
      if (!entriesRes.error && typeof entriesRes.count === "number") {
        setNewEntryCount(entriesRes.count);
      }
      if (!inquiriesRes.error && typeof inquiriesRes.count === "number") {
        setNewInquiryCount(inquiriesRes.count);
      }
    })();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/admin-login");
  };

  return (
    <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>
      <h1>me-ish 管理ダッシュボード</h1>
      <p style={{ color: "#666" }}>ログイン中: {adminEmail}</p>

      <ul style={{ marginTop: "2rem", lineHeight: 2 }}>
        <li>
          <a href="/admin/entries">
            応募作品の管理
            {newEntryCount > 0 && (
              <span style={{
                marginLeft: "0.5em",
                backgroundColor: "#e63946",
                color: "white",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: "0.8rem"
              }}>
                新着{newEntryCount}
              </span>
            )}
          </a>
        </li>
        <li>
          <a href="/admin/inquiries">
            お問い合わせ一覧
            {newInquiryCount > 0 && (
              <span style={{
                marginLeft: "0.5em",
                backgroundColor: "#e63946",
                color: "white",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: "0.8rem"
              }}>
                新着{newInquiryCount}
              </span>
            )}
          </a>
        </li>
        <li><a href="/admin/users">ユーザー管理（今後実装予定）</a></li>
        <li><a href="/admin/settings">ギャラリー設定（今後実装予定）</a></li>
      </ul>

      <button
        onClick={handleLogout}
        style={{ marginTop: "2rem", padding: "0.75rem 1.5rem", backgroundColor: "#ccc", border: "none" }}
      >
        ログアウト
      </button>
    </main>
  );
}
