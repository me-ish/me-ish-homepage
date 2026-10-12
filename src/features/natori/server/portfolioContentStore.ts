import "server-only";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {defaultPortfolioDisplayContent,parsePortfolioDisplayContent} from "../lib/portfolioDisplay";
import type {PortfolioDisplayContent} from "../types/portfolioDisplay";

/** Publication authorization must use a successful current read, never a fallback. */
export async function readPortfolioSavedState():Promise<{content:PortfolioDisplayContent;revision:number}> {
  const {data,error}=await supabaseAdmin().from("natori_portfolio_content").select("content,revision").eq("id","main").maybeSingle();
  if (error) throw new Error("Portfolio content unavailable");
  if (!data) return {content:defaultPortfolioDisplayContent(),revision:0};
  const content=parsePortfolioDisplayContent(data.content);
  if (!content || !Number.isSafeInteger(data.revision) || data.revision<0) throw new Error("Portfolio content invalid");
  return {content,revision:data.revision};
}
