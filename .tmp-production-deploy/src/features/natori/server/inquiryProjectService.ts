import "server-only";
import { z } from "zod";
import { buildInquiryProjectDraft, type NatoriInquiryInput } from "@/features/natori/lib/inquiry";
import {
  NATORI_REFERENCE_LINK_MAX_LENGTH,
  normalizeNatoriReferenceUrl,
} from "@/features/natori/lib/referenceLinks";
import { natoriRequestSubmissionV1Schema } from "@/features/natori/lib/requestSchema";
import {
  createNatoriIntakeViaRpc,
  findLinkedNatoriIntakeReferencePaths,
  type NatoriIntakeReferenceLinkRow,
} from "@/features/natori/server/intakeRpcAdapter";
import { deletePortfolioReferenceImages } from "@/features/natori/server/portfolioSiteService";
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

const MAX_INTAKE_REFERENCES = 5;
const NATORI_REFERENCE_PATH_LENGTH = 78;
const referenceObjectIdSchema = z.uuid({ version: "v4" });

function referencePathBelongsToSubmission(
  path: string,
  submissionId: string
): boolean {
  const segments = path.split("/");
  if (segments.length !== 2 || segments[0] !== submissionId) return false;
  const filename = segments[1];
  if (!filename.endsWith(".webp") || path !== path.toLowerCase()) return false;
  return referenceObjectIdSchema.safeParse(filename.slice(0, -5)).success;
}

const cleanupReferenceEnvelopeSchema = z.object({
  submissionId: z.uuid().transform((value) => value.toLowerCase()),
  referencePaths: z.array(z.string()).max(MAX_INTAKE_REFERENCES).default([]),
});

async function cleanupUnlinkedReferencePaths(referencePaths: string[]): Promise<void> {
  if (referencePaths.length === 0) return;
  const lookup = await findLinkedNatoriIntakeReferencePaths(referencePaths);
  if (lookup.kind === "unknown") return;
  const linkedPaths = new Set(lookup.linkedPaths);
  const unlinkedPaths = referencePaths.filter((path) => !linkedPaths.has(path));
  if (unlinkedPaths.length > 0) {
    await deletePortfolioReferenceImages(unlinkedPaths);
  }
}

async function cleanupSafelyScopedReferencePaths(input: unknown): Promise<void> {
  const parsed = cleanupReferenceEnvelopeSchema.safeParse(input);
  if (!parsed.success) return;
  const { submissionId, referencePaths } = parsed.data;
  if (
    referencePaths.some(
      (path) =>
        path.length !== NATORI_REFERENCE_PATH_LENGTH ||
        !referencePathBelongsToSubmission(path, submissionId)
    )
  ) {
    return;
  }
  await cleanupUnlinkedReferencePaths([...new Set(referencePaths)]);
}

const structuredReferenceLinkSchema = z.strictObject({
  url: z.string().trim().min(1).max(NATORI_REFERENCE_LINK_MAX_LENGTH),
  label: z.string().trim().max(100).nullable().optional(),
});

const structuredInquiryInputSchema = z
  .strictObject({
    submissionId: z.uuid().transform((value) => value.toLowerCase()),
    /**
     * 呼び出し元が owner を明示する経路。公開受付 route は
     * resolvePublicIntakeOwnerId の結果を必ずここへ渡し、session を owner 候補に
     * しない。未指定のときだけ管理系の session-first resolver へ委譲する。
     */
    ownerId: z.uuid().optional(),
    submission: natoriRequestSubmissionV1Schema,
    referencePaths: z
      .array(z.string().trim().length(NATORI_REFERENCE_PATH_LENGTH))
      .max(MAX_INTAKE_REFERENCES)
      .default([]),
    referenceLinks: z.array(structuredReferenceLinkSchema).max(MAX_INTAKE_REFERENCES).default([]),
  })
  .superRefine((value, context) => {
    const uniquePaths = new Set<string>();
    value.referencePaths.forEach((path, index) => {
      if (!referencePathBelongsToSubmission(path, value.submissionId)) {
        context.addIssue({
          code: "custom",
          path: ["referencePaths", index],
          message: "reference path must belong to the submission",
        });
      }
      if (uniquePaths.has(path)) {
        context.addIssue({
          code: "custom",
          path: ["referencePaths", index],
          message: "reference paths must be unique",
        });
      }
      uniquePaths.add(path);
    });
  });

export type CreateStructuredInquiryProjectInput = z.input<
  typeof structuredInquiryInputSchema
>;

export type CreateStructuredInquiryProjectResult =
  | { kind: "ok"; projectId: string }
  | { kind: "invalid-input" }
  | { kind: "no-owner" }
  /** DB が明確に拒否した。未参照 object は best-effort で cleanup 済み。 */
  | { kind: "db-error" }
  /**
   * 同一 envelope の1回 retry 後も結果が不明。commit 済みかもしれないので
   * Storage object は保持し、呼び出し元は ambiguous upstream として扱う。
   */
  | { kind: "unresolved" };

function normalizeReferenceLinks(
  links: Array<z.output<typeof structuredReferenceLinkSchema>>
): NatoriIntakeReferenceLinkRow[] | null {
  const seen = new Set<string>();
  const normalized: NatoriIntakeReferenceLinkRow[] = [];

  for (const [index, link] of links.entries()) {
    const normalizedUrl = normalizeNatoriReferenceUrl(link.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) return null;
    seen.add(normalizedUrl);
    normalized.push({
      url: link.url,
      normalized_url: normalizedUrl,
      label: link.label?.trim() || null,
      provider: null,
      sort_order: index,
    });
  }
  return normalized;
}

/**
 * Phase 1 structured intake. The caller creates submissionId before Storage
 * uploads; the same UUID becomes the project ID so every reference path is
 * transactionally associated with the intended project.
 */
export async function createStructuredInquiryProject(
  input: CreateStructuredInquiryProjectInput
): Promise<CreateStructuredInquiryProjectResult> {
  const parsed = structuredInquiryInputSchema.safeParse(input);
  if (!parsed.success) {
    await cleanupSafelyScopedReferencePaths(input);
    return { kind: "invalid-input" };
  }

  const { submissionId, submission, referencePaths, referenceLinks } = parsed.data;
  const normalizedLinks = normalizeReferenceLinks(referenceLinks);
  if (!normalizedLinks) {
    await cleanupUnlinkedReferencePaths(referencePaths);
    return { kind: "invalid-input" };
  }

  let ownerId: string | null = parsed.data.ownerId ?? null;
  if (!ownerId) {
    try {
      ownerId = await resolveNatoriActingUserId();
    } catch {
      await cleanupUnlinkedReferencePaths(referencePaths);
      return { kind: "no-owner" };
    }
  }
  if (!ownerId) {
    await cleanupUnlinkedReferencePaths(referencePaths);
    return { kind: "no-owner" };
  }

  const result = await createNatoriIntakeViaRpc({
    ownerId,
    projectId: submissionId,
    clientName: submission.clientName,
    clientEmail: submission.clientEmail,
    requestData: submission.requestData,
    referenceFiles: referencePaths,
    referenceLinks: normalizedLinks,
  });

  if (result.kind === "rejected") {
    await cleanupUnlinkedReferencePaths(referencePaths);
    return { kind: "db-error" };
  }
  if (result.kind === "unknown") {
    return { kind: "unresolved" };
  }
  if (result.projectId !== submissionId) {
    return { kind: "unresolved" };
  }
  return { kind: "ok", projectId: result.projectId };
}
