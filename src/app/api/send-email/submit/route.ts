// --- /app/api/send-email/submit/route.ts ---
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';
import { generateSubmitEmail, type SubmitEmailArgs } from '@/lib/emailTemplates/submit';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM ?? 'me-ish Gallery <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
const OPS_BCC = process.env.OP_BCC ?? ''; // 例: 'info@me-ish.art'（不要なら未設定）

// 入力は最小（to,name）だけでもOK。詳細フィールドは任意。
const SubmitInputSchema = z.object({
  to: z.string().email(),
  name: z.string().min(1),

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

    // ★ ここがポイント：必ず「詳細版」引数を組み立てる
    const args: SubmitEmailArgs = {
      name: input.name,
      entryTitle: input.entryTitle,
      galleryType: input.galleryType,
      salesType: input.salesType,
      priceYen: input.priceYen ?? null,
      editionTotal: input.editionTotal ?? null,
      submittedAtISO: input.submittedAtISO,
      manageUrl: input.manageUrl,
      editUrl: input.editUrl,
      faqUrl: input.faqUrl,             // テンプレ側のデフォルトあり
      termsUrl: input.termsUrl,         // 同上
      supportEmail: input.supportEmail ?? SUPPORT_EMAIL,
      slaHours: input.slaHours,         // 未指定ならテンプレ側で72h
    };

    const { subject, html, text } = generateSubmitEmail(args);

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
      // tags: [{ name: 'category', value: 'submit' }], // SDKが古くて型NGならコメントアウト
    });

    if (error) throw error;

    return NextResponse.json({ id: data?.id ?? null, status: 'sent' }, { status: 200 });
  } catch (err: any) {
    console.error('submit email error:', err?.message ?? err);
    return NextResponse.json(
      { error: 'Internal error while sending email' },
      { status: 500 }
    );
  }
}
