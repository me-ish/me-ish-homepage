import type { Metadata } from "next";
import { natoriAdminViewport } from "@/features/natori/constants/adminViewport";
import PaymentAttentionPanel from "@/features/natori/components/dashboard/PaymentAttentionPanel";
import ProjectsBoard from "@/features/natori/components/dashboard/ProjectsBoard";
import { NatoriPageShell } from "@/features/natori/components/admin/NatoriPageShell";
import { requireNatoriAccess } from "@/features/natori/server/requireNatoriAdmin";

export const dynamic = "force-dynamic";

export const viewport = natoriAdminViewport;

export const metadata: Metadata = {
  title: "Natori Projects | me-ish",
  description: "制作中の案件のカレンダーと一覧",
};

export default async function NatoriProjectsPage() {
  await requireNatoriAccess("/natori/projects");

  return (
    <NatoriPageShell current="projects" title="案件">
      <PaymentAttentionPanel />
      <ProjectsBoard />
    </NatoriPageShell>
  );
}
