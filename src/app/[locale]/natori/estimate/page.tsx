import type { Metadata } from "next";
import EstimateWorkspace from "@/features/natori/components/dashboard/EstimateWorkspace";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Natori Estimate | me-ish",
  description: "ナトリ先生の制作相談向けに、依頼文から概算見積もりと返信文のたたき台を作成する関係者向け内部ツールです。",
};

export default async function NatoriEstimatePage() {
  await requireNatoriAccess("/natori/estimate");

  return (
    <NatoriPageShell current="estimate" title="見積もり">
      <EstimateWorkspace />
    </NatoriPageShell>
  );
}
