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

function sanitizeTo(input: string) {
  return (input ?? '')
    .trim()
    // ゼロ幅系や制御文字を除去
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, '');
}

const EMAIL_RE =
  /^[^\s@"<>()[\]\\.,;:]+(\.[^\s@"<>()[\]\\.,;:]+)*@[^\s@"<>()[\]\\.,;:]+\.[^\s@"<>()[\]\\.,;:]{2,}$/i;

function getBaseUrl(req: Request) {
  // 1) x-forwarded-proto/host, 2) origin ヘッダ, 3) NEXT_PUBLIC_BASE_URL の順で解決
  const h = new Headers(req.headers);
  const xfProto = h.get('x-forwarded-proto');
  const xfHost = h.get('x-forwarded-host');
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;
  const origin = h.get('origin');
  if (origin) return origin;
  return process.env.NEXT_PUBLIC_BASE_URL || '';
}

/* -------------------------------------------
   GET: COAページ初期表示用の情報フェッチ
   /api/claim/[id]?t=<certToken>
------------------------------------------- */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const certToken = url.searchParams.get('t') || url.searchParams.get('token') || '';
    if (!certToken) {
      return NextResponse.json({ error: 'missing_token' }, { status: 401 });
    }

    const ver = await verifyCertToken(certToken);
    if (!ver.ok) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    if (params?.id && String(params.id) !== String(ver.entryId)) {
      return NextResponse.json({ error: 'mismatched_entry_id' }, { status: 409 });
    }

    const admin = supabaseAdmin();
    const { data: entry, error } = await admin
      .from('entries')
      .select('id,title,image_url,sale_type,token_id,edition_total,edition_sold')
      .eq('id', ver.entryId)
      .maybeSingle();

    if (error) {
      console.error('[claim][GET] entries lookup error', error, { entryId: ver.entryId });
    }
    if (!entry) {
      return NextResponse.json(
        { error: 'entry_not_found', details: { entryId: ver.entryId } },
        { status: 404 }
      );
    }

    const editionRemain =
      typeof entry.edition_total === 'number' && typeof entry.edition_sold === 'number'
        ? Math.max(0, Number(entry.edition_total) - Number(entry.edition_sold))
        : null;

    return NextResponse.json({
      ok: true,
      entry: {
        id: entry.id,
        title: entry.title ?? null,
        imageUrl: entry.image_url ?? null,
        saleType: String(entry.sale_type ?? '').toLowerCase(),
        tokenId: entry.token_id ?? null,
        editionTotal: entry.edition_total ?? null,
        editionSold: entry.edition_sold ?? null,
        editionRemain,
      },
    });
  } catch (e) {
    console.error('[claim][GET] error:', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

/* -------------------------------------------
   POST: 受け取り処理
   - mode === 'address' : 既存の claimTo（ウォレット直受け）
   - mode === 'email'   : 受け取りリンクを購入者へメール送信
------------------------------------------- */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));

    // 受け取りモード（既定は address）
    const mode: 'address' | 'email' = body?.mode === 'email' ? 'email' : 'address';

    const certToken: string = body?.certToken ?? body?.token ?? '';
    if (!certToken) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    // 1) 証明トークン検証 → entryId
    const ver = await verifyCertToken(certToken);
    if (!ver.ok) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    // URL の [id] とトークン内の entryId の整合
    if (params?.id && String(params.id) !== String(ver.entryId)) {
      return NextResponse.json({ error: 'mismatched_entry_id' }, { status: 409 });
    }

    const admin = supabaseAdmin();
    const { data: entry, error: entryErr } = await admin
      .from('entries')
      .select('id,title,sale_type,token_id,edition_total,edition_sold')
      .eq('id', ver.entryId)
      .maybeSingle();

    if (entryErr) {
      console.error('[claim] entries lookup error', entryErr, { entryId: ver.entryId });
    }
    if (!entry) {
      return NextResponse.json(
        { error: 'entry_not_found', details: { entryId: ver.entryId } },
        { status: 404 }
      );
    }

    // NFT 以外は拒否
    const saleType = String(entry.sale_type ?? '').toLowerCase();
    if (saleType !== 'nft') {
      return NextResponse.json({ error: 'not_nft_entry' }, { status: 409 });
    }

    // 共通: 残数計算（完売ガード）
    const maxRemain =
      typeof entry.edition_total === 'number' && typeof entry.edition_sold === 'number'
        ? Math.max(0, Number(entry.edition_total) - Number(entry.edition_sold))
        : 1;

    if (maxRemain <= 0) {
      return NextResponse.json({ error: 'sold_out' }, { status: 409 });
    }

    // ----------------------------------
    // A) mode === 'email'（受け取りリンクをメール送信）
    // ----------------------------------
    if (mode === 'email') {
      const toEmail: string = String(body?.email ?? '').trim();
      if (!EMAIL_RE.test(toEmail)) {
        return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
      }

      // 受け取りリンク（COA）を作成（まずは既存トークンを再送）
      const baseUrl = getBaseUrl(req);
      if (!baseUrl) {
        return NextResponse.json({ error: 'server_misconfig_baseurl' }, { status: 500 });
      }
      const claimUrl = `${baseUrl}/cert/${entry.id}?t=${encodeURIComponent(certToken)}`;

      // 内部メールAPIを管理トークン付きで叩く
      const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
      if (!ADMIN_API_TOKEN) {
        return NextResponse.json({ error: 'server_misconfig_admin_token' }, { status: 500 });
      }

      const buyerName: string =
        (typeof body?.name === 'string' && body.name.trim()) || 'ご購入者様';

      const emailRes = await fetch(`${baseUrl}/api/send-email/purchaseNft`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-meish-admin-token': ADMIN_API_TOKEN,
        },
        body: JSON.stringify({
          to: toEmail,
          name: buyerName,
          title: entry.title ?? 'ご購入作品',
          tokenId: entry.token_id ?? 0,
          claimUrl,
        }),
      });

      if (!emailRes.ok) {
        const text = await emailRes.text().catch(() => '');
        console.error('[claim][email] send failed:', emailRes.status, text);
        return NextResponse.json({ error: 'email_send_failed' }, { status: 502 });
      }

      return NextResponse.json({
        ok: true,
        mode: 'email',
        message: '受け取り用のメールを送信しました',
      });
    }

    // ----------------------------------
    // B) mode === 'address'（既存の claimTo フロー）
    // ----------------------------------
    // ← addressでもtoでもOKにする（後方互換）
    const toRaw: string = body?.to ?? body?.address ?? '';
    const to = sanitizeTo(toRaw);

    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return NextResponse.json({ error: 'invalid_to' }, { status: 400 });
    }

    // tokenId / quantity 決定
    const tokenIdFromClient = body?.tokenId;
    const quantityFromClient = body?.quantity;

    const tokenId =
      tokenIdFromClient != null
        ? Number(tokenIdFromClient)
        : entry.token_id != null
        ? Number(entry.token_id)
        : NaN;

    if (!Number.isFinite(tokenId)) {
      return NextResponse.json({ error: 'invalid_token_id' }, { status: 400 });
    }

    const desired = quantityFromClient != null ? Number(quantityFromClient) : 1;
    const quantity = Math.max(1, Math.min(desired, maxRemain));

// Thirdweb で claimTo（1155）
const chainEnv = process.env.CHAIN_NAME || '';
const chain = normalizeChainName(chainEnv);
// どちらの環境変数でも拾えるように両対応
const privateKey =
  process.env.MEISH_WALLET_PRIVATE_KEY ||
  process.env.THIRDWEB_PRIVATE_KEY ||
  '';
const secretKey = process.env.THIRDWEB_SECRET_KEY || '';
const contractAddress = process.env.NFT_1155_CONTRACT_ADDRESS || '';

if (!chain || !privateKey || !secretKey || !contractAddress) {
  console.error('[claim] misconfig', {
    chainEnv,
    hasPK: !!privateKey,
    hasSK: !!secretKey,
    contractAddress,
  });
  return NextResponse.json({ error: 'server_misconfig' }, { status: 500 });
}

// ====== ここから try に含める（SDK初期化～getContract～tx）======
try {
  // SDK 初期化
  if (!privateKey.startsWith('0x')) {
    // 0x抜けやフォーマット不正
    return NextResponse.json({ error: 'bad_private_key' }, { status: 500 });
  }
  const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chain as any, { secretKey });

  // コントラクト取得
  const contract = await sdk.getContract(contractAddress);
  if (!('erc1155' in contract)) {
    // EditionDrop(ERC1155) 以外
    return NextResponse.json({ error: 'bad_contract_type' }, { status: 500 });
  }

  // 送信
  const txRes = await contract.erc1155.claimTo(to, tokenId, quantity);
  const txhash = txRes.receipt.transactionHash;

  // edition_sold のカウントアップ（非致命）
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

  return NextResponse.json({
    ok: true,
    mode: 'address',
    entryId: entry.id,
    tokenId,
    quantity,
    txhash,
  });
} catch (e: any) {
  // ここでThirdweb/RPCのエラー内容を可視化
  const err = {
    name: e?.name,
    message: e?.message,
    reason: e?.reason,              // viem/ethers 系でよく入る
    shortMessage: e?.shortMessage,  // viem 系
    code: e?.code,                  // 'INSUFFICIENT_FUNDS' 等
  };
  console.error('[claim] tx error', err);

  const msg = `${e?.message || ''}`.toLowerCase();

  if (e?.code === 'INSUFFICIENT_FUNDS' || msg.includes('insufficient funds')) {
    return NextResponse.json({ error: 'insufficient_gas' }, { status: 402 });
  }
  if (msg.includes('no claim condition') || msg.includes('no active claim condition')) {
    return NextResponse.json({ error: 'no_claim_condition' }, { status: 409 });
  }
  if (msg.includes('not minted') || (msg.includes('token') && msg.includes('does not exist'))) {
    return NextResponse.json({ error: 'token_not_minted' }, { status: 409 });
  }
  if (msg.includes('exceeds') && msg.includes('max')) {
    return NextResponse.json({ error: 'quantity_exceeds_max' }, { status: 409 });
  }
  if (msg.includes('chain') && msg.includes('mismatch')) {
    return NextResponse.json({ error: 'wrong_chain' }, { status: 409 });
  }
  if (msg.includes('could not connect') || msg.includes('timeout') || msg.includes('network')) {
    return NextResponse.json({ error: 'rpc_unavailable' }, { status: 502 });
  }

  // デフォルト
  return NextResponse.json({ error: 'tx_failed' }, { status: 500 });
}


    // ====== /デバッグ強化 ======

  } catch (e: any) {
    console.error('[claim] error:', e);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}

