// src/app/api/admin/mint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generatePurchaseNftEmail } from '@/lib/emailTemplates/purchaseNft';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import type { Database } from '@/types/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/* ------------------------------ utils ------------------------------ */

// timing-safe header token check
function assertAdmin(req: NextRequest) {
  const cfg = process.env.ADMIN_API_TOKEN || '';
  const token = req.headers.get('x-meish-admin-token') || '';
  if (!cfg) {
    const err = new Error('server misconfig: ADMIN_API_TOKEN');
    (err as any).status = 500;
    throw err;
  }
  const a = Buffer.from(cfg);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    const err = new Error('unauthorized');
    (err as any).status = 401;
    throw err;
  }
}

// http/https のみ許可
function ensureHttpUrl(u: string): string | null {
  try {
    const url = new URL(u);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString();
    return null;
  } catch {
    return null;
  }
}

function normalizeChainName(name: string) {
  const n = (name || '').toLowerCase();
  if (n === 'mumbai' || n === 'polygon-mumbai') return 'mumbai';
  if (n === 'amoy' || n === 'polygon-amoy') return 'amoy';
  if (n === 'polygon' || n === 'mainnet' || n === 'matic') return 'polygon';
  return n;
}
function networkLabel(chain: string) {
  if (chain === 'polygon') return 'Polygon';
  if (chain === 'amoy') return 'Polygon Amoy';
  if (chain === 'mumbai') return 'Polygon Mumbai';
  return chain;
}

function isEthAddress(s?: string | null) {
  return !!s && /^0x[a-fA-F0-9]{40}$/.test(s);
}

/* ------------------------------ validators ------------------------------ */

const Body = z.object({
  sessionId: z.string().min(8).max(255),
  name: z.string().min(1).max(120),
  imageUrl: z.string().url(),
});

/* ------------------------------ services ------------------------------ */

const resend = new Resend(process.env.RESEND_API_KEY || '');
const FROM = process.env.RESEND_FROM ?? 'me-ish <noreply@me-ish.art>';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? 'support@me-ish.art';
const OP_BCC = (process.env.OP_BCC || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/* ------------------------------ handler ------------------------------ */

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);

    // validate body
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    const { sessionId, name, imageUrl } = parsed.data;

    // strictly allow only http/https for imageUrl
    const safeImage = ensureHttpUrl(imageUrl);
    if (!safeImage) {
      return NextResponse.json({ error: 'imageUrl must be http/https' }, { status: 400 });
    }

    // envs
    const chainEnv = process.env.CHAIN_NAME || '';
    const chain = normalizeChainName(chainEnv);
    if (!chain) {
      return NextResponse.json({ error: 'CHAIN_NAME is required' }, { status: 500 });
    }

    const privateKey = process.env.THIRDWEB_PRIVATE_KEY || '';
    const secretKey = process.env.THIRDWEB_SECRET_KEY || '';
    const contractAddress = process.env.NFT_CONTRACT_ADDRESS || '';
    const toWallet = process.env.MEISH_WALLET_ADDRESS || '';

    if (!privateKey || !secretKey) {
      return NextResponse.json({ error: 'Thirdweb keys missing' }, { status: 500 });
    }
    if (!isEthAddress(contractAddress) || !isEthAddress(toWallet)) {
      return NextResponse.json({ error: 'invalid contract/wallet address' }, { status: 500 });
    }

    const admin = supabaseAdmin();

    // 1) lookup sale by stripe_session_id
    type SaleRow = Database['public']['Tables']['sales']['Row'];
    const { data: sale, error: sErr } = await admin
      .from('sales')
      .select('id, entry_id, buyer_email, stripe_session_id, metadata')
      .eq('stripe_session_id', sessionId)
      .single<SaleRow>();

    if (sErr || !sale) {
      return NextResponse.json({ error: 'sale not found' }, { status: 404 });
    }

    // 1.5) 作品が NFT 販売かを確認（entries.sale_type を見る）
    const { data: entrySaleType } = await admin
      .from('entries')
      .select('sale_type')
      .eq('id', sale.entry_id)
      .single<{ sale_type: string | null }>();

    if ((entrySaleType?.sale_type || '').toLowerCase() !== 'nft') {
      return NextResponse.json({ error: 'not NFT sale' }, { status: 400 });
    }

    // metadata に mint 状態を保持する想定
    const meta = (sale.metadata ?? {}) as Record<string, any>;
    if (meta.mint_status === 'minted') {
      return NextResponse.json({
        ok: true,
        message: 'already minted',
        editionNo: meta.edition_no ?? null,
        tokenId: meta.token_id ?? null,
      });
    }

    // 2) Thirdweb mint
    const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain as any, { secretKey });
    const contract = await sdk.getContract(contractAddress);
    const mintTx = await contract.erc721.mintTo(toWallet, { name, image: safeImage });
    const tokenId = mintTx.id.toString();
    const txhash = mintTx.receipt.transactionHash;

    // 3) 在庫カウント更新（1枚分）: public.finalize_sale(entry_id, quantity)
    //    -> edition_sold をインクリメントし、最新値を返す
    const { data: fin, error: finErr } = await admin.rpc('finalize_sale', {
      p_entry_id: sale.entry_id,
      p_quantity: 1,
      // ← body でバリデート済みの sessionId は string 確定なのでこちらを渡す
      p_session_id: sessionId,
      // もし念のため sale 側を優先したいなら ↓ でもOK（結果は string 型）
      // p_session_id: sale.stripe_session_id ?? sessionId,
    }) 

if (finErr) {
  console.error('[mint] finalize_sale error:', finErr);
  return NextResponse.json({ error: 'finalize sale failed' }, { status: 500 });
}
const editionNo = (fin as any)?.new_edition_sold ?? null;

    // 4) sales.metadata を更新（mint 済み情報を保存）
    const newMeta: Record<string, any> = {
      ...meta,
      mint_status: 'minted',
      token_id: tokenId,
      txhash,
      edition_no: editionNo,
      minted_by: 'admin',
      minted_at: new Date().toISOString(),
    };

    const { error: upErr } = await admin
      .from('sales')
      .update({ metadata: newMeta as unknown as Database['public']['Tables']['sales']['Row']['metadata'] })
      .eq('id', sale.id);

    if (upErr) {
      console.error('[mint] update sales.metadata error:', upErr);
      // mint 自体は成功しているので 200 を返す（ログのみ）
    }

    // 5) notify (best-effort)
    try {
      if (sale.buyer_email && process.env.RESEND_API_KEY) {
        const { data: entry } = await admin
          .from('entries')
          .select('title')
          .eq('id', sale.entry_id)
          .single<{ title: string | null }>();

        const title = entry?.title ?? `Token #${tokenId}`;
        const claimUrl =
          process.env.NFT_CLAIM_BASE_URL
            ? `${process.env.NFT_CLAIM_BASE_URL}?token=${encodeURIComponent(tokenId)}`
            : `https://thirdweb.com/${chain}/${contractAddress}/${tokenId}`;

        const { subject, html, text } = generatePurchaseNftEmail({
          name: 'お客様',
          title,
          tokenId,
          claimUrl,
          network: networkLabel(chain),
        });

        await resend.emails.send({
          from: FROM,
          to: [sale.buyer_email],
          ...(OP_BCC.length ? { bcc: OP_BCC } : {}),
          subject,
          html,
          text,
          replyTo: SUPPORT_EMAIL,
          headers: {
            'List-Unsubscribe': `<mailto:${SUPPORT_EMAIL}>`,
            'X-Meish-Template': 'purchase-nft',
          },
        });
      }
    } catch (e) {
      console.warn('[mint] email failed:', e);
    }

    return NextResponse.json({
      ok: true,
      entryId: sale.entry_id,
      editionNo,
      tokenId,
      txhash,
    });
  } catch (e: any) {
    const status = e?.status ?? (e?.message === 'unauthorized' ? 401 : 500);
    if (status !== 401) console.error('[mint] error:', e);
    return NextResponse.json(
      { error: status === 401 ? 'unauthorized' : 'internal error' },
      { status }
    );
  }
}

