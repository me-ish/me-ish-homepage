import type { Metadata } from "next";
import { natoriAdminViewport } from "@/features/natori/constants/adminViewport";
import InquiriesBoard from "@/features/natori/components/dashboard/InquiriesBoard";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const viewport = natoriAdminViewport;

export const metadata: Metadata = {
  title: "Natori Inquiries | me-ish",
  description:
    "ご依頼フォームから届いた問い合わせの内容確認・見積もり/支払いメール送信・進捗管理を行うページです。",
};

export default async function NatoriInquiriesPage() {
  await requireNatoriAccess("/natori/inquiries");

  return (
    <NatoriPageShell current="inquiries" title="問い合わせ">
      <InquiriesBoard />
    </NatoriPageShell>
  );
}
