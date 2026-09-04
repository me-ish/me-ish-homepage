// app/etorie/page.tsx
// エトリエ（コミッション受注管理サービス）のティザーLP。
// 正式公開前のため noindex（公開判断のタイミングで robots を外す）。
import type { Metadata } from "next";
import EtorieLanding from "@/features/etorie/components/EtorieLanding";

const title = "エトリエ étrier — イラストレーターのための受注管理";
const description =
  "コミッションの受付から入金まで、これひとつ。依頼の受付・見積もり・承諾・カード決済・案件管理・実績づくりをひとつの画面にまとめた受注管理ツールです。";

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
