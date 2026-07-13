// /natori/links: ナトリのリンク集（公開ページ）。
// 掲載リンクは DB (natori_links_content) から読み込む。編集は /natori/links/edit。
import type { Metadata } from "next";
import LinksLanding from "@/features/natori/components/links/LinksLanding";
import { loadNatoriLinksContent } from "@/features/natori/server/linksSiteService";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Natori Links",
  description: "イラストレーター ナトリのリンク集。ポートフォリオ・SNS・コミッション受付。",
};

export default async function Page() {
  const content = await loadNatoriLinksContent();
  return <LinksLanding links={content.links} />;
}
