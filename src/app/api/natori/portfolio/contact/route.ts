// api/natori/portfolio/contact/route.ts
// /natori/portfolio のご依頼フォーム送信。業務ロジックは portfolioContactService に集約。
//
// キャラクター資料の画像はフォーム送信（multipart/form-data）に同梱する方式。
// 以前あった単独の公開アップロードAPI（contact/upload）はフォーム送信と紐付かず
// 匿名画像ホスティングとして悪用可能だったため廃止した。画像の保存は honeypot・
// バリデーション通過後にのみ行われる。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkRateLimit, getIpFromRequest, rateLimitExceeded } from "@/lib/rateLimit";
import {
  isPortfolioContactConfigured,
  portfolioContactSchema,
  sendPortfolioContactAutoReply,
  sendPortfolioContactEmail,
} from "@/features/natori/server/portfolioContactService";
import {
  deletePortfolioReferenceImages,
  signPortfolioReferenceImage,
  uploadPortfolioReferenceImage,
} from "@/features/natori/server/portfolioSiteService";
import { createInquiryProject } from "@/features/natori/server/inquiryProjectService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_REF_IMAGES = 5;

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

export async function POST(req: Request) {
  const csrfErr = checkCsrf(req);
  if (csrfErr) return csrfErr;

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

    let rawFields: Record<string, unknown>;
    let files: File[] = [];
    if (isMultipart) {
      const form = await req.formData();
      rawFields = fieldsFromFormData(form);
      files = form.getAll("refImages").filter((v): v is File => v instanceof File);
    } else {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      // JSON 経路では refImages（任意URL）を受け付けない。外部URLを通知メールの
      // <img> に流し込まれるのを防ぐ（資料URLはテキストの refUrls / 詳細欄で受ける）
      rawFields = { ...body, refImages: [] };
    }

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
  } catch (err) {
    console.error("[natori-portfolio-contact] Unhandled Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
