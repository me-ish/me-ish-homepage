// /src/app/api/admin/mint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ----- Supabase (server-only admin) -----
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ----- Simple header token auth -----
function assertAdmin(req: NextRequest) {
  const cfg = process.env.ADMIN_API_TOKEN;
  const token = req.headers.get('x-meish-admin-token');
  if (!cfg || !token || token !== cfg) {
    const err = new Error('unauthorized');
    (err as any).status = 401;
    throw err;
  }
}

// ----- Resend -----
const resend = new Resend(process.env.RESEND_API_KEY!);

// 任意：チェーン名の補正（環境で 'mumbai' を渡している場合の保険）
function normalizeChainName(name: string) {
  const n = (name || '').toLowerCase();
  if (n === 'mumbai' || n === 'polygon-mumbai') return 'mumbai';
  if (n === 'amoy' || n === 'polygon-amoy') return 'amoy';
  return n || 'polygon';
}

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req);

    const body = await req.json().catch(() => null);
    const sessionId: string | undefined = body?.sessionId;
    const name: string | undefined = body?.name;
    const imageUrl: string | undefined = body?.imageUrl;

    if (!sessionId || !name || !imageUrl) {
      return NextResponse.json(
        { error: 'sessionId, name, imageUrl は必須です' },
        { status: 400 }
      );
    }

    // 簡易URLバリデーション
    try {
      // eslint-disable-next-line no-new
      new URL(imageUrl);
    } catch {
      return NextResponse.json(
        { error: 'imageUrl が不正です' },
        { status: 400 }
      );
    }

    // 1) sale をセッションで特定
    const { data: sale, error: sErr } = await supabaseAdmin
      .from('sales')
      .select('id, entry_id, buyer_email, mint_status, type, edition_no')
      .eq('stripe_session_id', sessionId)
      .single();

    if (sErr || !sale) {
      return NextResponse.json({ error: 'sale not found' }, { status: 404 });
    }
    if (sale.type !== 'nft') {
      return NextResponse.json({ error: 'not NFT sale' }, { status: 400 });
    }
    if (sale.mint_status === 'minted') {
      return NextResponse.json({
        ok: true,
        message: 'already minted',
        editionNo: sale.edition_no,
      });
    }
    if (sale.mint_status !== 'pending') {
      return NextResponse.json(
        { error: `invalid mint_status: ${sale.mint_status}` },
        { status: 409 }
      );
    }

    // 2) Thirdweb SDK を “ここで” 初期化（secretKey 必須）
    const chain = normalizeChainName(process.env.CHAIN_NAME || 'polygon');
    const privateKey = process.env.THIRDWEB_PRIVATE_KEY!;
    const secretKey = process.env.THIRDWEB_SECRET_KEY!; // ← Vercel に必ず設定

    if (!privateKey || !secretKey) {
      return NextResponse.json(
        { error: 'Thirdweb の環境変数が不足しています' },
        { status: 500 }
      );
    }

    const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain as any, {
      secretKey, // ★ これがないと本番で "Please provide a secretKey" が出ます
    });

    const contractAddress = process.env.NFT_CONTRACT_ADDRESS!;
    const toWallet = process.env.MEISH_WALLET_ADDRESS!;

    if (!contractAddress || !toWallet) {
      return NextResponse.json(
        { error: 'NFT_CONTRACT_ADDRESS / MEISH_WALLET_ADDRESS が未設定です' },
        { status: 500 }
      );
    }

    const contract = await sdk.getContract(contractAddress);
    const mintTx = await contract.erc721.mintTo(toWallet, { name, image: imageUrl });
    const tokenId = mintTx.id.toString();
    const txhash = mintTx.receipt.transactionHash;

    // 3) 版番号の採番 & sales更新（RPCで原子的に確定）
    const { data: rpc, error: mErr } = await supabaseAdmin.rpc('mark_nft_minted', {
      p_stripe_session_id: sessionId,
      p_token_id: tokenId,
      p_txhash: txhash,
      p_minted_by: 'admin',
    });

    if (mErr) {
      console.error('[mint] mark_nft_minted error:', mErr);
      // 必要に応じて手動ロールバック（burn等）を検討
      return NextResponse.json({ error: 'mark minted failed' }, { status: 500 });
    }

    const { entry_id, edition_no } = (rpc?.[0] ??
      {}) as { entry_id: number; edition_no: number };

    // 4) メール（失敗しても全体は成功扱い）
    try {
      const nftUrl = `https://thirdweb.com/${chain}/${contractAddress}/${tokenId}`;
      if (sale.buyer_email) {
        await resend.emails.send({
          from: 'me-ish <noreply@me-ish.art>',
          to: sale.buyer_email,
          subject: '【me-ish】NFTを鋳造しました',
          html: `
            <p>ご購入ありがとうございます。NFT (#${edition_no}) を鋳造しました。</p>
            <p><a href="${nftUrl}">${nftUrl}</a></p>
            <p>受け取りや転送方法については、運営からの案内をご確認ください。</p>
          `,
        });
      }
    } catch (e) {
      console.warn('[mint] email failed:', e);
    }

    return NextResponse.json({
      ok: true,
      entryId: entry_id,
      editionNo: edition_no,
      tokenId,
      txhash,
    });
  } catch (e: any) {
    const status = e?.status ?? (e?.message === 'unauthorized' ? 401 : 500);
    if (status !== 401) console.error('[mint] error:', e);
    return NextResponse.json({ error: status === 401 ? 'unauthorized' : 'internal error' }, { status });
  }
}
