// app/etorie/page.tsx
// エトリエ（コミッション受注管理サービス）のティザーLP。
// 正式公開前のため noindex（公開判断のタイミングで robots を外す）。
import type { Metadata } from "next";
import EtorieLanding from "@/features/etorie/components/EtorieLanding";

const title = "エトリエ étrier — 描くあなたを、支える道具。";
const description =
  "イラストレーターのための受注管理ツール。依頼の受付から見積もり・承諾・カード決済・案件管理・実績まで、コミッションの事務をひとつに。";

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
  openGraph: { title, description },
  twitter: { card: "summary", title, description },
};

export default function Page() {
  return <EtorieLanding />;
}
