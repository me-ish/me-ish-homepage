import type { Metadata } from "next";
import { Paperclip } from "lucide-react";
import ConsultationThread from "@/features/natori/components/consultation/ConsultationThread";
import RenewConsultationLink from "@/features/natori/components/consultation/RenewConsultationLink";
import NatoriClientShell from "@/features/natori/components/client/NatoriClientShell";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";
import { getClientConsultation } from "@/features/natori/server/consultationService";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ナトリとの相談", robots: { index: false, follow: false } };
type Props = { params: Promise<{ token: string }> };

export default async function NatoriConsultationPage({ params }: Props) {
  const { token } = await params;
  const conversation = await getClientConsultation(token);
  const hasIntake = conversation ? Boolean(conversation.initialInquiry) || conversation.initialFilesState === "unavailable" || conversation.initialFiles.length > 0 : false;
  return (
    <NatoriClientShell title="ナトリとの相談" subtitle={conversation?.title}>
      <meta name="referrer" content="no-referrer" />
      {conversation ? <div className="space-y-5">
        {hasIntake ? <div className={`${ui.card} space-y-4`}>
          {conversation.initialInquiry ? <div><p className={ui.label}>最初のご相談</p><p className={`mt-2 whitespace-pre-wrap break-words rounded-2xl bg-[#FFF8FA] px-4 py-3 ${ui.body}`}>{conversation.initialInquiry}</p></div> : null}
          {conversation.initialFilesState==="unavailable"?<p role="status" className={ui.alertWarning}>受付時の資料一覧を取得できません。提出状況は、ページを再読み込みして確認してください。</p>:null}
          {conversation.initialFiles.length?<div><p className={ui.label}>受付時の資料</p><div className="mt-2 flex flex-wrap gap-2">{conversation.initialFiles.map(file=>file.url?<a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className={`inline-flex max-w-full items-center gap-2 break-all rounded-full border border-[#F2D9E0] bg-white px-4 py-2 text-[14px] font-bold leading-5 text-[#BE185D] underline underline-offset-2 transition-colors hover:bg-[#FFF8FA] ${ui.focus}`}><Paperclip className="h-4 w-4 shrink-0" aria-hidden />{file.name}</a>:<p key={file.id} role="status" className={`w-full ${ui.alertWarning}`}>{file.name} — 提出済みです。リンクを取得できません。再読み込みしてください。</p>)}</div></div>:null}
        </div> : null}
        <ConsultationThread mode="client" token={token} initialMessages={conversation.messages} closed={conversation.closed} />
      </div>
        : <RenewConsultationLink token={token} />}
    </NatoriClientShell>
  );
}
