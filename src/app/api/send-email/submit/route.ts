// --- /app/api/send-email/submit/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { generateSubmitEmail, type SubmitEmailArgs } from '@/lib/emailTemplates/submit';

// ★ ここは環境ごとに設定
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
const OPS_BCC = process.env.OP_BCC ?? ''; // 例: 'info@me-ish.art'（不要なら未設定）

// 旧・新どちらの入力にも対応できるスキーマ
const SubmitInputSchema = z.object({
  to: z.string().email(),
  name: z.string().min(1),
  // 以下は詳細テンプレ用（任意）
  entryTitle: z.string().optional(),
  galleryType: z.enum(['WHITE', 'FLOAT', 'SPECIAL']).optional(),
  salesType: z.enum(['normal', 'nft']).optional(),
  priceYen: z.number().int().nonnegative().optional(),
  editionTotal: z.number().int().positive().optional(),
  submittedAtISO: z.string().datetime().optional(),
  manageUrl: z.string().url().optional(),
  editUrl: z.string().url().optional(),
  faqUrl: z.string().url().optional(),
  termsUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  slaHours: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = SubmitInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // 詳細指定が一切なければ、後方互換（nameのみ）で送る
    const hasDetails =
      input.entryTitle !== undefined ||
      input.galleryType !== undefined ||
      input.salesType !== undefined ||
      input.priceYen !== undefined ||
      input.editionTotal !== undefined ||
      input.submittedAtISO !== undefined ||
      input.manageUrl !== undefined ||
      input.editUrl !== undefined;

    const { subject, html, text } = hasDetails
      ? generateSubmitEmail({
          name: input.name,
          entryTitle: input.entryTitle,
          galleryType: input.galleryType,
          salesType: input.salesType,
          priceYen: input.priceYen,
          editionTotal: input.editionTotal,
          submittedAtISO: input.submittedAtISO,
          manageUrl: input.manageUrl,
          editUrl: input.editUrl,
          faqUrl: input.faqUrl,
          termsUrl: input.termsUrl,
          supportEmail: input.supportEmail ?? SUPPORT_EMAIL,
          slaHours: input.slaHours,
        } satisfies SubmitEmailArgs)
      : generateSubmitEmail(input.name);

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [input.to],
      ...(OPS_BCC ? { bcc: [OPS_BCC] } : {}),
      subject,
      html,
      text,
      replyTo: SUPPORT_EMAIL,
      headers: {
        'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
        'X-Meish-Template': 'submit',
      },
      // Resendのtags（対応環境なら）
      tags: [{ name: 'category', value: 'submit' }],
    });
    if (error) throw error;

    // SDKのレスポンスをそのまま返さず、必要最小限だけ返す
return NextResponse.json(
  { id: data?.id ?? null, status: 'sent' },
  { status: 200 }
);
  } catch (err: any) {
    // 機密は出さず、短いエラーを返す
    console.error('submit email error:', err?.message ?? err);
    return NextResponse.json(
      { error: 'Internal error while sending email' },
      { status: 500 }
    );
  }
}
