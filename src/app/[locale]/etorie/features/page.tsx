// app/etorie/features/page.tsx
// エトリエの機能一覧ページ。正式公開前のため noindex（LP と同じ扱い）。
import type { Metadata } from "next";
import EtorieFeatures from "@/features/etorie/components/EtorieFeatures";

const title = "エトリエ 機能一覧 — 受注管理ツールでできること";
const description =
  "ダッシュボード・問い合わせ管理・見積もり・承諾/カード決済・案件カレンダー・売上/実績、そしてポートフォリオとリンク集。エトリエの機能一覧。";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: { title, description },
  twitter: { card: "summary", title, description },
};

export default function Page() {
  return <EtorieFeatures />;
}
