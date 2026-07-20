import "server-only";
import { buildInquiryProjectDraft, type NatoriInquiryInput } from "@/features/natori/lib/inquiry";
import { createNatoriAdminProject } from "@/features/natori/server/projectsService";
import { resolveNatoriActingUserId } from "@/features/natori/server/natoriOwner";

export type CreateInquiryProjectResult =
  | { kind: "ok"; projectId: string }
  | { kind: "no-owner" }
  | { kind: "db-error" };

/**
 * ご依頼フォームの送信内容を、案件管理の `inquiry`（依頼受付）案件として起票する。
 * Phase 1: フォーム＝案件の入口にする配線。公開フォームから呼ばれるため認可は
 * せず、service role で所有者（ナトリ先生）の案件として保存する。
 *
 * 金額・納期プランは未確定なので既定値（0円・通常納期＝約1ヶ月）。ナトリ先生が
 * 見積もり時に案件画面から調整する前提。
 */
export async function createInquiryProject(
  input: NatoriInquiryInput,
  referencePaths: string[] = []
): Promise<CreateInquiryProjectResult> {
  const userId = await resolveNatoriActingUserId();
  if (!userId) return { kind: "no-owner" };

  const draft = buildInquiryProjectDraft(input);
  const result = await createNatoriAdminProject({
    userId,
    title: draft.title,
    clientName: draft.clientName,
    clientEmail: draft.clientEmail,
    amount: 0,
    type: draft.type,
    status: "inquiry",
    nextAction: "内容確認・お見積もり",
    note: draft.note,
    referencePaths,
  });

  if (result.kind === "db-error") return { kind: "db-error" };
  return { kind: "ok", projectId: result.projectId };
}
