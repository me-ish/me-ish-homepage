import "server-only";

import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { parsePortfolioContent } from "@/features/natori/lib/portfolioContent";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TABLE = "natori_portfolio_content";
const ROW_ID = "main";

export type PublicCommissionAvailability =
  | {
      kind: "ok";
      commissionOpen: boolean;
      massProductionIllustrationOpen: boolean;
    }
  | { kind: "unavailable" };

/**
 * 公開受付APIがUI表示とは独立して現在の受付状態を確認するための読み取り。
 * DBエラーや壊れた保存値を「受付中」と推測しないよう fail-closed にする。
 * 行がまだ無い環境だけは公開ページと同じ defaultPortfolioContent を使う。
 */
export async function loadPublicCommissionAvailability(): Promise<PublicCommissionAvailability> {
  try {
    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .select("content")
      .eq("id", ROW_ID)
      .maybeSingle();

    if (error) {
      console.error("[natori-public-intake] availability load failed:", error);
      return { kind: "unavailable" };
    }

    const content = data
      ? parsePortfolioContent(data.content)
      : defaultPortfolioContent;
    if (!content) {
      console.error("[natori-public-intake] availability content invalid");
      return { kind: "unavailable" };
    }

    return {
      kind: "ok",
      commissionOpen: content.commissionOpen,
      massProductionIllustrationOpen: content.massProductionIllustrationOpen,
    };
  } catch (error) {
    console.error("[natori-public-intake] availability load threw:", error);
    return { kind: "unavailable" };
  }
}
