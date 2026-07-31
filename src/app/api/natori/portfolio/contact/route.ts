// api/natori/portfolio/contact/route.ts
// /natori/portfolio のご依頼フォーム送信。業務ロジックは portfolioContactService と
// inquiryProjectService に集約。
//
// キャラクター資料の画像はフォーム送信（multipart/form-data）に同梱する方式。
// 以前あった単独の公開アップロードAPI（contact/upload）はフォーム送信と紐付かず
// 匿名画像ホスティングとして悪用可能だったため廃止した。画像の保存は honeypot・
// バリデーション通過後にのみ行われる。
//
// 入口で payload version を明示分岐する:
// - formVersion = "etorie-request-v1" … P1-06 structured 受付（create v2 RPC）
// - それ以外 …………………………… 現行フォーム互換の legacy 受付（挙動据え置き）
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import {
  isPortfolioContactConfigured,
  portfolioContactSchema,
  sendPortfolioContactAutoReply,
  sendPortfolioContactEmail,
  sendStructuredPortfolioContactAutoReply,
  sendStructuredPortfolioContactEmail,
} from "@/features/natori/server/portfolioContactService";
import {
  deletePortfolioReferenceImages,
  signPortfolioReferenceImage,
  uploadPortfolioReferenceImage,
} from "@/features/natori/server/portfolioSiteService";
import {
  createInquiryProject,
  createStructuredInquiryProject,
} from "@/features/natori/server/inquiryProjectService";
import { resolvePublicIntakeOwnerId } from "@/features/natori/server/publicIntakeOwner";
import { isPublicStructuredIntakeEnabled } from "@/features/natori/server/publicIntakeRollout";
import {
  NATORI_REQUEST_DATA_MAX_BYTES,
  natoriRequestSubmissionV1Schema,
} from "@/features/natori/lib/requestSchema";
import {
  NATORI_REQUEST_SCHEMA_VERSION,
  type NatoriRequestSubmissionV1,
} from "@/features/natori/types/request";
import {
  NATORI_MAX_REFERENCE_IMAGES,
  NATORI_MAX_REFERENCE_LINKS,
  NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES,
  NATORI_STRUCTURED_FORM_VERSION,
} from "@/features/natori/lib/portfolioRequestForm";
import { normalizeNatoriReferenceUrl } from "@/features/natori/lib/referenceLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_REF_IMAGES = NATORI_MAX_REFERENCE_IMAGES;
/** multipart 全体の上限。画像10MiB + フォーム本文の余裕分。 */
const MAX_REQUEST_BYTES = 12 * 1024 * 1024;

/** 外部へ返す error 分類。内部 DB error や constraint 名は返さない。 */
type ContactErrorCode =
  | "invalid_request"
  | "upload_failed"
  | "submission_rejected"
  | "temporarily_unavailable";

type FieldError = { path: string; message: string };

function fail(code: ContactErrorCode, status: number, fields?: FieldError[]) {
  return NextResponse.json(
    { ok: false, error: code, ...(fields && fields.length > 0 ? { fields } : {}) },
    { status }
  );
}

/** multipart のフィールドを portfolioContactSchema の入力形へ組み立てる */
function fieldsFromFormData(form: FormData): Record<string, unknown> {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    name: text("name"),
    email: text("email"),
    requestType: text("requestType"),
    plan: text("plan"),
    options: form.getAll("options").filter((v): v is string => typeof v === "string"),
    budget: text("budget"),
    deadline: text("deadline"),
    refUrls: text("refUrls"),
    refImages: [], // 添付はファイル実体から作る。URL の直接指定は受け付けない
    details: text("details"),
    message: text("message"),
    website: text("website"),
  };
}

function formText(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function isHoneypotFilled(value: string): boolean {
  return value.trim() !== "";
}

/** honeypot は保存も送信もせず成功風に終了する（ボットにストレージを使わせない）。 */
function honeypotResponse() {
  return NextResponse.json({ success: true, ok: true, mailed: false, spam: true });
}

export async function POST(req: Request) {
  // 1. request metadata / security validation
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

  const originErr = checkSameOrigin(req);
  if (originErr) return originErr;

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return fail("invalid_request", 400);
  }

  const ip = getIpFromRequest(req);
  const rl = await checkRateLimit(`natori-portfolio-contact:${ip}`, {
    limit: 3,
    windowMs: 600_000,
  });
  if (!rl.allowed) return rateLimitExceeded(rl.retryAfterMs);

  try {
    const isMultipart = (req.headers.get("content-type") ?? "").includes(
      "multipart/form-data"
    );

    // 2. form payload parse（version 分岐は payload 到着直後に1回だけ行う）
    if (isMultipart) {
      const form = await req.formData();
      if (formText(form, "formVersion") === NATORI_STRUCTURED_FORM_VERSION) {
        return await handleStructuredSubmission(form);
      }
      const files = form.getAll("refImages").filter((v): v is File => v instanceof File);
      return await handleLegacySubmission(fieldsFromFormData(form), files, ip);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.formVersion === NATORI_STRUCTURED_FORM_VERSION) {
      // structured 受付は資料同梱のため multipart のみ受け付ける。
      return fail("invalid_request", 400);
    }
    // JSON 経路では refImages（任意URL）を受け付けない。外部URLを通知メールの
    // <img> に流し込まれるのを防ぐ（資料URLはテキストの refUrls / 詳細欄で受ける）
    return await handleLegacySubmission({ ...body, refImages: [] }, [], ip);
  } catch (err) {
    console.error("[natori-portfolio-contact] Unhandled Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------
   P1-06 structured 受付（RequestData V1 + natori_create_project_with_tasks_v2）
------------------------------------------------------------------- */

type ParsedReferenceLink = { url: string; label: string | null };

function parseReferenceLinkRows(
  raw: string
): { kind: "ok"; links: ParsedReferenceLink[] } | { kind: "invalid"; fields: FieldError[] } {
  if (raw.trim() === "") return { kind: "ok", links: [] };

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return {
      kind: "invalid",
      fields: [{ path: "referenceLinks", message: "参考URLの形式が不正です。" }],
    };
  }
  if (!Array.isArray(decoded)) {
    return {
      kind: "invalid",
      fields: [{ path: "referenceLinks", message: "参考URLの形式が不正です。" }],
    };
  }
  if (decoded.length > NATORI_MAX_REFERENCE_LINKS) {
    return {
      kind: "invalid",
      fields: [
        {
          path: "referenceLinks",
          message: `参考URLは最大${NATORI_MAX_REFERENCE_LINKS}件までです。`,
        },
      ],
    };
  }

  const fields: FieldError[] = [];
  const links: ParsedReferenceLink[] = [];
  const seen = new Set<string>();

  decoded.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      fields.push({ path: `referenceLinks.${index}.url`, message: "参考URLの形式が不正です。" });
      return;
    }
    const record = entry as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const label = typeof record.label === "string" ? record.label.trim() : "";
    if (url === "") return;
    if (label.length > 100) {
      fields.push({ path: `referenceLinks.${index}.label`, message: "ラベルが長すぎます。" });
      return;
    }
    // server 側の normalize が真実源。外部URLへのアクセスは一切しない。
    const normalized = normalizeNatoriReferenceUrl(url);
    if (!normalized) {
      fields.push({
        path: `referenceLinks.${index}.url`,
        message: "https:// で始まる URL を入力してください（ID・パスワード付きは不可）。",
      });
      return;
    }
    if (seen.has(normalized)) {
      fields.push({
        path: `referenceLinks.${index}.url`,
        message: "同じURLが重複しています。",
      });
      return;
    }
    seen.add(normalized);
    links.push({ url, label: label === "" ? null : label });
  });

  if (fields.length > 0) return { kind: "invalid", fields };
  return { kind: "ok", links };
}

/**
 * client から届いた request_data をそのまま RPC へ渡さず、共有 schema で
 * 再 parse して canonical object を作る。schemaVersion / formVersion /
 * legacySource は server 側の固定値で上書きする（§P1-06-13）。
 */
function parseCanonicalRequestData(
  raw: string,
  clientName: string,
  clientEmail: string
):
  | { kind: "ok"; submission: NatoriRequestSubmissionV1 }
  | { kind: "invalid"; fields: FieldError[] } {
  if (new TextEncoder().encode(raw).byteLength > NATORI_REQUEST_DATA_MAX_BYTES) {
    return {
      kind: "invalid",
      fields: [{ path: "requestData", message: "入力量が上限を超えています。" }],
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return {
      kind: "invalid",
      fields: [{ path: "requestData", message: "送信内容の形式が不正です。" }],
    };
  }
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    return {
      kind: "invalid",
      fields: [{ path: "requestData", message: "送信内容の形式が不正です。" }],
    };
  }

  const canonicalCandidate = {
    ...(decoded as Record<string, unknown>),
    schemaVersion: NATORI_REQUEST_SCHEMA_VERSION,
    formVersion: NATORI_STRUCTURED_FORM_VERSION,
    legacySource: null,
  };

  const parsed = natoriRequestSubmissionV1Schema.safeParse({
    clientName,
    clientEmail,
    requestData: canonicalCandidate,
  });
  if (!parsed.success) {
    return {
      kind: "invalid",
      fields: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  return { kind: "ok", submission: parsed.data };
}

async function handleStructuredSubmission(form: FormData) {
  // honeypot は保存・送信の前に判定する。
  if (isHoneypotFilled(formText(form, "website"))) return honeypotResponse();

  // Production では既定で無効。Preview で明示的に有効化した環境だけ v2 writer を使う。
  if (!isPublicStructuredIntakeEnabled()) {
    return fail("temporarily_unavailable", 503);
  }

  // 3. shared RequestData V1 schema validation
  const parsedSubmission = parseCanonicalRequestData(
    formText(form, "requestData"),
    formText(form, "name"),
    formText(form, "email")
  );
  if (parsedSubmission.kind === "invalid") {
    return fail("invalid_request", 400, parsedSubmission.fields);
  }
  const submission = parsedSubmission.submission;

  // 4. public intake owner 解決（session は owner 候補にしない）
  const owner = resolvePublicIntakeOwnerId();
  if (owner.kind !== "ok") return fail("temporarily_unavailable", 503);

  // 5. project UUID は画像 path 生成より前に1回だけ作る（retry でも変えない）
  const projectId = crypto.randomUUID();

  // 6. external URL normalize / duplicate 検証（URL へは接続しない）
  const parsedLinks = parseReferenceLinkRows(formText(form, "referenceLinks"));
  if (parsedLinks.kind === "invalid") {
    return fail("invalid_request", 400, parsedLinks.fields);
  }

  // 7. 画像 validation / 変換 / upload
  const files = form.getAll("refImages").filter((v): v is File => v instanceof File);
  if (files.length > MAX_REF_IMAGES) {
    return fail("invalid_request", 400, [
      { path: "refImages", message: `画像は最大${MAX_REF_IMAGES}枚までです。` },
    ]);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES) {
    return fail("invalid_request", 400, [
      { path: "refImages", message: "画像の合計サイズが上限を超えています。" },
    ]);
  }

  const referencePaths: string[] = [];
  for (const file of files) {
    const result = await uploadPortfolioReferenceImage(file, projectId);
    if (result.kind === "ok") {
      referencePaths.push(result.path);
      continue;
    }
    // RPC 呼び出し前の失敗なので、今回 upload した object だけを削除する。
    await deletePortfolioReferenceImages(referencePaths);
    if (result.kind === "upload-error") return fail("upload_failed", 502);
    return fail("invalid_request", 400, [
      {
        path: "refImages",
        message:
          result.kind === "too-large"
            ? "1枚あたりのサイズが上限を超えています。"
            : "対応していない画像形式です（png / jpg / webp / gif）。",
      },
    ]);
  }

  // 8. create v2 RPC。cleanup と retry の境界は inquiryProjectService が持つ。
  const created = await createStructuredInquiryProject({
    submissionId: projectId,
    ownerId: owner.ownerId,
    submission,
    referencePaths,
    referenceLinks: parsedLinks.links,
  });

  if (created.kind === "no-owner") return fail("temporarily_unavailable", 503);
  if (created.kind === "unresolved") {
    // 結果不明。commit 済みの可能性があるため object は保持し、
    // project UUID は内部の突合キーとしてのみ扱う（response / 一般 log に出さない）。
    return fail("temporarily_unavailable", 503);
  }
  if (created.kind !== "ok") {
    // 明確な validation / rejection。未参照 object は service 側で cleanup 済み。
    return fail("submission_rejected", 400);
  }

  // 9. 成功メール。DB 受付成功後は失敗しても案件を rollback / archive / 削除しない。
  let mailed = false;
  let autoReplied = false;
  if (isPortfolioContactConfigured()) {
    const mailInput = {
      clientName: submission.clientName,
      clientEmail: submission.clientEmail,
      requestData: submission.requestData,
      referenceImageCount: referencePaths.length,
      referenceLinkUrls: parsedLinks.links.map((link) => link.url),
    };
    try {
      const sent = await sendStructuredPortfolioContactEmail(mailInput);
      mailed = sent.mailed;
    } catch {
      console.error("[natori-portfolio-contact] structured mail threw");
    }
    try {
      const autoReply = await sendStructuredPortfolioContactAutoReply(mailInput);
      autoReplied = autoReply.mailed;
    } catch {
      console.error("[natori-portfolio-contact] structured auto-reply threw");
    }
  } else {
    console.error("[natori-portfolio-contact] mail skipped: RESEND_API_KEY not set");
  }

  // 10. safe response。submission ID / project ID は返さない。
  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      mailed,
      autoReplied,
      mailDelivery: mailed ? "sent" : "mail_delivery_failed",
    },
    { status: 201 }
  );
}

/* ------------------------------------------------------------------
   現行フォーム互換（legacy）。挙動・レスポンス契約は据え置き。
------------------------------------------------------------------- */

async function handleLegacySubmission(
  rawFields: Record<string, unknown>,
  files: File[],
  ip: string | null
) {
  const parsed = portfolioContactSchema.safeParse(rawFields);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 蜜壺：値が入っていたら成功風レスポンスで終了（保存も送信もしない）。
  // 画像の保存より先に判定することで、ボットにストレージを使わせない。
  if (parsed.data.website && parsed.data.website.trim() !== "") {
    return NextResponse.json({ success: true, mailed: false, spam: true });
  }

  // 添付画像の保存（フォーム送信と一体でのみ行う）
  if (files.length > MAX_REF_IMAGES) {
    return NextResponse.json({ error: "too_many_files" }, { status: 400 });
  }
  const submissionId = crypto.randomUUID();
  const referencePaths: string[] = [];
  for (const file of files) {
    const result = await uploadPortfolioReferenceImage(file, submissionId);
    if (result.kind === "invalid-type") {
      await deletePortfolioReferenceImages(referencePaths);
      return NextResponse.json({ error: "invalid_mime" }, { status: 400 });
    }
    if (result.kind === "too-large") {
      await deletePortfolioReferenceImages(referencePaths);
      return NextResponse.json({ error: "file_too_large" }, { status: 400 });
    }
    if (result.kind === "upload-error") {
      await deletePortfolioReferenceImages(referencePaths);
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }
    referencePaths.push(result.path);
  }
  // 非公開パスは案件資料テーブルへ関連付け、note やメール本文へは保存しない。
  const input = { ...parsed.data, refImages: [] };

  // Phase 1: フォーム送信を案件（inquiry）として起票する。これを一次的な
  // 永続化とし、メールは通知として扱う。どちらか一方でも成功すれば依頼は
  // 失われないので success を返す。
  let caseCreated = false;
  try {
    const result = await createInquiryProject(input, referencePaths);
    caseCreated = result.kind === "ok";
    if (!caseCreated) {
      console.error("[natori-portfolio-contact] case creation failed:", result.kind);
    }
  } catch (caseErr) {
    console.error("[natori-portfolio-contact] case creation threw:", caseErr);
  }

  if (!caseCreated && referencePaths.length > 0) {
    await deletePortfolioReferenceImages(referencePaths);
    return NextResponse.json({ error: "inquiry not recorded" }, { status: 500 });
  }

  // 通知メールにだけ7日間の署名URLを入れる。DBには非公開storage pathだけを保持。
  const signedReferenceUrls = (
    await Promise.all(
      referencePaths.map((path) => signPortfolioReferenceImage(path, 60 * 60 * 24 * 7))
    )
  ).filter((url): url is string => Boolean(url));
  const mailInput = { ...input, refImages: signedReferenceUrls };

  let mailed = false;
  let autoReplied = false;
  if (isPortfolioContactConfigured()) {
    const sent = await sendPortfolioContactEmail(mailInput, ip);
    mailed = sent.mailed;
    // 依頼者向けの受付確認（自動返信）。失敗しても受付自体は成功扱い
    try {
      const autoReply = await sendPortfolioContactAutoReply(mailInput);
      autoReplied = autoReply.mailed;
    } catch (autoReplyErr) {
      console.error("[natori-portfolio-contact] auto-reply threw:", autoReplyErr);
    }
  } else {
    console.error("[natori-portfolio-contact] mail skipped: RESEND_API_KEY not set");
  }

  if (!caseCreated && !mailed) {
    return NextResponse.json({ error: "inquiry not recorded" }, { status: 500 });
  }
  return NextResponse.json({ success: true, mailed, autoReplied, caseCreated });
}
