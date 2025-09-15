// src/app/api/claim/[id]/route.ts
import { NextResponse } from 'next/server';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyCertToken } from '@/lib/coa/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeChainName(name: string) {
  const n = (name || '').toLowerCase();
  if (n === 'polygon-mumbai' || n === 'mumbai') return 'mumbai';
  if (n === 'polygon-amoy' || n === 'amoy') return 'amoy';
  if (n === 'polygon' || n === 'matic' || n === 'mainnet') return 'polygon';
  return n;
}

type Ctx = { params: { id: string } };

function sanitizeTo(input: string) {
  return (input ?? '')
    .trim()
    // ゼロ幅系や制御文字を除去
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '');
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    // ← addressでもtoでもOKにする（後方互換）
    const toRaw: string = body?.to ?? body?.address ?? '';
    const to = sanitizeTo(toRaw);

    const certToken: string = body?.certToken ?? body?.token ?? '';
    const tokenIdFromClient = body?.tokenId;
    const quantityFromClient = body?.quantity;

    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return NextResponse.json({ error: 'invalid_to' }, { status: 400 });
    }
    if (!certToken) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    // 1) 証明トークン検証 → entryId
    const ver = await verifyCertToken(certToken);
    if (!ver.ok) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    // URL の [id] とトークン内の entryId が異なる場合は弾く（任意）
    if (params?.id && String(params.id) !== String(ver.entryId)) {
      return NextResponse.json({ error: 'mismatched_entry_id' }, { status: 409 });
    }

    const admin = supabaseAdmin();
    const { data: entry, error: entryErr } = await admin
      .from('entries')
      .select('id,sale_type,token_id,edition_total,edition_sold')
      .eq('id', ver.entryId)
      .maybeSingle();

    if (entryErr) {
      console.error('[claim] entries lookup error', entryErr, { entryId: ver.entryId, token: certToken });
    }
    if (!entry) {
      return NextResponse.json(
        { error: 'entry_not_found', details: { entryId: ver.entryId } },
        { status: 404 }
      );
    }

    // 2) NFT 以外は拒否
    const saleType = String(entry.sale_type ?? '').toLowerCase();
    if (saleType !== 'nft') {
      return NextResponse.json({ error: 'not_nft_entry' }, { status: 409 });
    }

    // 3) tokenId / quantity 決定
    const tokenId =
      tokenIdFromClient != null
        ? Number(tokenIdFromClient)
        : entry.token_id != null
        ? Number(entry.token_id)
        : NaN;

    if (!Number.isFinite(tokenId)) {
      return NextResponse.json({ error: 'invalid_token_id' }, { status: 400 });
    }

    const maxRemain =
      typeof entry.edition_total === 'number' && typeof entry.edition_sold === 'number'
        ? Math.max(0, Number(entry.edition_total) - Number(entry.edition_sold))
        : 1;

    const quantity =
      quantityFromClient != null
        ? Math.max(1, Math.min(Number(quantityFromClient), maxRemain || 1))
        : 1;

    // 4) Thirdweb で claimTo（1155）
    const chainEnv = process.env.CHAIN_NAME || '';
    const chain = normalizeChainName(chainEnv);
    const privateKey = process.env.THIRDWEB_PRIVATE_KEY || '';
    const secretKey = process.env.THIRDWEB_SECRET_KEY || '';
    const contractAddress = process.env.NFT_1155_CONTRACT_ADDRESS || '';

    if (!chain || !privateKey || !secretKey || !contractAddress) {
      console.error('[claim] misconfig', { chainEnv, hasPK: !!privateKey, hasSK: !!secretKey, contractAddress });
      return NextResponse.json({ error: 'server_misconfig' }, { status: 500 });
    }

    const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain as any, { secretKey });
    const contract = await sdk.getContract(contractAddress);

    const txRes = await contract.erc1155.claimTo(to, tokenId, quantity);
    const txhash = txRes.receipt.transactionHash;

    // 5) edition_sold のカウントアップ（任意）
    try {
      if (typeof entry.edition_sold === 'number') {
        await admin
          .from('entries')
          .update({ edition_sold: Number(entry.edition_sold) + quantity })
          .eq('id', entry.id);
      }
    } catch (e) {
      console.warn('[claim] post update failed (non-fatal):', e);
    }

    return NextResponse.json({ ok: true, entryId: entry.id, tokenId, quantity, txhash });
  } catch (e: any) {
    console.error('[claim] error:', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
