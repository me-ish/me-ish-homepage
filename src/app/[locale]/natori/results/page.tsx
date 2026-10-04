import type { Metadata } from "next";
import ResultsBoard from "@/features/natori/components/dashboard/ResultsBoard";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Natori Results | me-ish",
  description: "ナトリの納品済み案件の件数・売上・月別推移を確認する実績ページです。",
};

export default async function NatoriResultsPage() {
  await requireNatoriAccess("/natori/results");

  return (
    <NatoriPageShell current="results" title="実績">
      <ResultsBoard />
    </NatoriPageShell>
  );
}
