import type { Metadata } from "next";
import { natoriAdminViewport } from "@/features/natori/constants/adminViewport";
import InquiriesBoard from "@/features/natori/components/dashboard/InquiriesBoard";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";
import {caseDashboardSystemMode} from "@/features/natori/server/caseDashboardPreview";
import {CaseWorkspaceEntryPage,type CaseEntrySearch} from "@/features/natori/components/caseWorkspace/CaseWorkspaceEntryPage";

export const dynamic = "force-dynamic";

export const viewport = natoriAdminViewport;

export const metadata: Metadata = {
  title: "Natori Inquiries | me-ish",
  description:
    "ご依頼フォームから届いた問い合わせの内容確認・見積もり/支払いメール送信・進捗管理を行うページです。",
};

export default async function NatoriInquiriesPage({searchParams}:{searchParams:Promise<CaseEntrySearch>}) {
  await requireNatoriAccess("/natori/inquiries");
  const mode=await caseDashboardSystemMode();if(mode!=="off")return <CaseWorkspaceEntryPage input={await searchParams} entry="cases" source="inquiries" preview readOnly={mode==="read-only"}/>;

  return (
    <NatoriPageShell current="inquiries" title="問い合わせ">
      <InquiriesBoard />
    </NatoriPageShell>
  );
}
