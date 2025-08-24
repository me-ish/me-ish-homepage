// /src/app/api/admin/mint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { Resend } from 'resend';

export const runtime = 'nodejs';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 管理者APIトークンで簡易認証
function assertAdmin(req: NextRequest) {
  const token = req.headers.get('x-meish-admin-token');
  if (!token || token !== process.env.ADMIN_API_TOKEN) {
    throw new Error('unauthorized');
  }
}

// Thirdweb
const CHAIN = process.env.CHAIN_NAME || 'polygon'; // 'mumbai' / 'polygon'
const sdk = ThirdwebSDK.fromPrivateKey(process.env.THIRDWEB_PRIVATE_KEY!, CHAIN);
const contractAddress = process.env.NFT_CONTRACT_ADDRESS!;
const fromWallet = process.env.MEISH_WALLET_ADDRESS!;

// Email
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    assertAdmin(req); // 認可

    const { sessionId, name, imageUrl } = await req.json();
    if (!sessionId || !name || !imageUrl) {
      return NextResponse.json({ error: 'sessionId, name, imageUrl は必須です' }, { status: 400 });
    }

    // 1) sales をセッションで特定（pending のNFTだけ許可）
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
      // 冪等：既にMint済みなら結果をそのまま返す
      return NextResponse.json({ ok: true, message: 'already minted', editionNo: sale.edition_no });
    }
    if (sale.mint_status !== 'pending') {
      return NextResponse.json({ error: `invalid mint_status: ${sale.mint_status}` }, { status: 409 });
    }

    // 2) Mint 実行（fromWallet へ鋳造）
    const contract = await sdk.getContract(contractAddress);
    const mintTx = await contract.erc721.mintTo(fromWallet, { name, image: imageUrl });
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
      // 失敗時は手動ロールバック検討（例：burn）— まずはログだけ
      console.error('[mint] mark_nft_minted error:', mErr);
      return NextResponse.json({ error: 'mark minted failed' }, { status: 500 });
    }

    const { entry_id, edition_no } = (rpc?.[0] ?? {}) as { entry_id: number; edition_no: number };

    // 4) 購入者へメール（失敗しても処理は成功扱い）
    try {
      const nftUrl = `https://thirdweb.com/${CHAIN}/${contractAddress}/${tokenId}`;
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

    return NextResponse.json({ ok: true, entryId: entry_id, editionNo: edition_no, tokenId, txhash });
  } catch (e: any) {
    if (e?.message === 'unauthorized') {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    console.error('[mint] error:', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
