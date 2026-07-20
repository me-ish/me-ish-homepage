// src/app/admin/api/entries/[id]/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminAuth } from '@/lib/auth/requireAdminAuth';
import Stripe from 'stripe';
import { getSiteUrl } from '@/lib/constants';
import { logAdminAction } from '@/lib/adminAudit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const PLAN_PRICES: Record<string, number> = {
  mini: 400,
  light: 800,
  standard: 1200,
  premium: 2400,
};

const PLAN_LABELS: Record<string, string> = {
  mini: 'Mini',
  light: 'Light',
  standard: 'Standard',
  premium: 'Premium',
};

type ProcessingJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

type ProcessingJob = {
  id: string;
  entry_id: number;
  status: ProcessingJobStatus;
  attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // まず認証
  const auth = await requireAdminAuth(req);
  if (!auth.ok) return auth.response;

  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const admin = supabaseAdmin();

  // 0) 対象取得（メール/作家名/ファイル名など）
  const { data: entry, error: selErr } = await admin
    .from('entries')
    .select(
      'id, artist_name, email, external_user_id, title, gallery_type, file_name, image_url, is_for_sale, display_plan, plan_payment_status, plan_payment_amount_yen, has_signature'
    )
    .eq('id', id)
    .single();

  if (selErr || !entry) {
    return NextResponse.json({ error: selErr?.message || 'not_found' }, { status: 404 });
  }

  const fileName = (entry.file_name || '').trim();
  if (!fileName) {
    return NextResponse.json({ error: 'missing file_name' }, { status: 400 });
  }

  // 1) 画像を加工待ち領域へ copy
  {
    const { error: copyErr } = await admin.storage
      .from('artworks')
      .copy(fileName, `pending-processing/${fileName}`);
    if (copyErr && !String(copyErr.message || '').includes('already exists')) {
      return NextResponse.json({ error: `copy_failed: ${copyErr.message}` }, { status: 500 });
    }
  }

  // 2) メタJSONを processing-meta/pending にアップロード
  {
    // hasSignature: true → WM不要、false → WM付与
    const meta = {
      artistName: entry.artist_name,
      filename: fileName,
      hasSignature: (entry as any).has_signature === true,
    };
    const body = Buffer.from(JSON.stringify(meta), 'utf-8');
    const { error: upErr } = await admin.storage
      .from('processing-meta')
      .upload(`pending/${entry.id}.json`, body, {
        contentType: 'application/json',
        upsert: true,
      });
    if (upErr) {
      return NextResponse.json({ error: `enqueue_failed: ${upErr.message}` }, { status: 500 });
    }
  }

  // 3) DB 承認フラグ（+ user_id が未設定なら email で補完）
  let updatedEntry;
  {
    const patch: Record<string, unknown> = {
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    };

    // user_id が未設定の場合、email でauth.usersを引いて補完する
    if (entry.email) {
      const { data: authUserId } = await (admin.rpc as Function)('get_auth_user_id_by_email', { p_email: entry.email });
      if (authUserId) {
        patch.user_id = authUserId;
      }
    }
    const { data: updated, error: updErr } = await admin
      .from('entries')
      .update(patch)
      .eq('id', id)
      .select(
        'id, artist_name, email, external_user_id, title, gallery_type, file_name, image_url, confirmed, confirmed_at'
      )
      .single();
    if (updErr || !updated) {
      return NextResponse.json({ error: updErr?.message || 'update_failed' }, { status: 500 });
    }
    updatedEntry = updated;
  }

  // 4) 承認メール（失敗しても承認は維持）
  try {
    if (entry.email && entry.external_user_id) {
      await fetch(`${getSiteUrl()}/api/send-email/pass`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-meish-admin-token': process.env.ADMIN_API_TOKEN!,
        },
        body: JSON.stringify({
          to: entry.email,
          name: entry.artist_name,
          externalUserId: entry.external_user_id,
        }),
        cache: 'no-store',
      });
    }
  } catch (e) {
  }  // 5) Auto-create checkout URL and email it for paid plans.
  // - succeeded/running のジョブは上書きしない（事故防止）
  // - failed/queued のジョブは queued にリセット（再試行）
  // 5) paid plan??????URL????????????
  try {
    const plan = String(entry.display_plan ?? 'free');
    const needsPlanPayment =
      entry.is_for_sale === true &&
      plan !== 'free' &&
      String(entry.plan_payment_status ?? 'pending').toLowerCase() !== 'paid';

    if (needsPlanPayment && entry.email) {
      const amountYen = Number(entry.plan_payment_amount_yen ?? PLAN_PRICES[plan] ?? 0);
      if (Number.isFinite(amountYen) && amountYen > 0) {
        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [
            {
              price_data: {
                currency: 'jpy',
                product_data: {
                  name: `me-ish Display Plan (${PLAN_LABELS[plan] ?? plan})`,
                  description: entry.title ?? undefined,
                },
                unit_amount: amountYen,
              },
              quantity: 1,
            },
          ],
          customer_email: entry.email,
          success_url: `${getSiteUrl()}/mypage?planPaid=1`,
          cancel_url: `${getSiteUrl()}/mypage?planCanceled=1`,
          client_reference_id: String(entry.id),
          metadata: {
            kind: 'entry_plan',
            entryId: String(entry.id),
            displayPlan: plan,
            planAmountYen: String(amountYen),
          },
        });

        if (session.url) {
          await admin
            .from('entries')
            .update({
              plan_payment_status: 'pending',
              plan_payment_amount_yen: amountYen,
              plan_payment_session_id: session.id,
              plan_payment_checkout_created_at: new Date().toISOString(),
            })
            .eq('id', entry.id);

          await fetch(`${getSiteUrl()}/api/send-email/planPaymentRequest`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-meish-admin-token': process.env.ADMIN_API_TOKEN!,
            },
            body: JSON.stringify({
              to: entry.email,
              name: entry.artist_name || 'applicant',
              title: entry.title || 'artwork',
              displayPlan: PLAN_LABELS[plan] ?? plan,
              amountYen,
              paymentUrl: session.url,
              manageUrl: `${getSiteUrl()}/mypage`,
            }),
            cache: 'no-store',
          });
        }
      }
    }
  } catch (e) {
    console.error('[approve] plan checkout/email failed:', e);
  }

  // 6) processing job upsert
  let job: ProcessingJob;
  {
    // まず既存ジョブを確認
    const { data: existingJob } = await admin
      .from('entry_processing_jobs')
      .select('*')
      .eq('entry_id', id)
      .single();

    if (existingJob && (existingJob.status === 'succeeded' || existingJob.status === 'running')) {
      // 既に成功済み or 処理中の場合はそのまま返す（上書きしない）
      job = existingJob as ProcessingJob;
    } else {
      // 新規作成 or failed/queued をリセット
      const { data: upsertedJob, error: jobErr } = await admin
        .from('entry_processing_jobs')
        .upsert(
          {
            entry_id: id,
            status: 'queued',
            attempts: 0,
            locked_at: null,
            locked_by: null,
            last_error: null,
          },
          { onConflict: 'entry_id' }
        )
        .select()
        .single();

      if (jobErr || !upsertedJob) {
        // ジョブ作成失敗はログに残すが、承認自体は成功扱い
        console.error('[approve] job upsert failed:', jobErr);
        // ダミーのジョブ情報を返す
        job = {
          id: '',
          entry_id: id,
          status: 'queued',
          attempts: 0,
          locked_at: null,
          locked_by: null,
          last_error: jobErr?.message || 'upsert_failed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      } else {
        job = upsertedJob as ProcessingJob;
      }
    }
  }

  logAdminAction({ adminEmail: auth.adminEmail, action: "approve_entry", resourceType: "entry", resourceId: String(id) });

  return NextResponse.json({ ok: true, entry: updatedEntry, job }, { status: 200 });
}
