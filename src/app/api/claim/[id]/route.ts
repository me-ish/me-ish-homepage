// src/app/api/claim/[id]/route.ts
import { NextResponse } from 'next/server';
import { ThirdwebSDK, NATIVE_TOKEN_ADDRESS } from '@thirdweb-dev/sdk';
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
  return (input ?? '').trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, '');
}
const EMAIL_RE =
  /^[^\s@"<>()[\]\\.,;:]+(\.[^\s@"<>()[\]\\.,;:]+)*@[^\s@"<>()[\]\\.,;:]+\.[^\s@"<>()[\]\\.,;:]{2,}$/i;
function getBaseUrl(req: Request) {
  const h = new Headers(req.headers);
  const xfProto = h.get('x-forwarded-proto');
  const xfHost = h.get('x-forwarded-host');
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`;
  const origin = h.get('origin');
  if (origin) return origin;
  return process.env.NEXT_PUBLIC_BASE_URL || '';
}

/* 互換ラッパー: getClaimIneligibilityReasons シグネチャ差吸収 */
async function getClaimIneligibilityReasonsCompat(
  contract: any,
  tokenId: number,
  quantity: number,
  wallet: string
): Promise<string[]> {
  const cc = contract.erc1155.claimConditions;
  try { const r = await cc.getClaimIneligibilityReasons(tokenId, quantity, wallet); if (Array.isArray(r)) return r; } catch {}
  try { const r = await cc.getClaimIneligibilityReasons(wallet, tokenId, quantity); if (Array.isArray(r)) return r; } catch {}
  try { const r = await cc.getClaimIneligibilityReasons(wallet, quantity); if (Array.isArray(r)) return r; } catch {}
  return [];
}

/* GET */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(req.url);
    const certToken = url.searchParams.get('t') || url.searchParams.get('token') || '';
    if (!certToken) return NextResponse.json({ error: 'missing_token' }, { status: 401 });
    const ver = await verifyCertToken(certToken);
    if (!ver.ok) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    if (params?.id && String(params.id) !== String(ver.entryId)) {
      return NextResponse.json({ error: 'mismatched_entry_id' }, { status: 409 });
    }

    const admin = supabaseAdmin();
    const { data: entry, error } = await admin
      .from('entries')
      .select('id,title,image_url,sale_type,token_id,edition_total,edition_sold')
      .eq('id', ver.entryId)
      .maybeSingle();

    if (error) console.error('[claim][GET] entries lookup error', error, { entryId: ver.entryId });
    if (!entry) return NextResponse.json({ error: 'entry_not_found', details: { entryId: ver.entryId } }, { status: 404 });

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

/* POST */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    console.info('[claim] build', { v: 'r5-airdrop-fallback' });

    const body = await req.json().catch(() => ({}));
    const mode: 'address' | 'email' = body?.mode === 'email' ? 'email' : 'address';

    const certToken: string = body?.certToken ?? body?.token ?? '';
    if (!certToken) return NextResponse.json({ error: 'missing_token' }, { status: 400 });

    const ver = await verifyCertToken(certToken);
    if (!ver.ok) return NextResponse.json({ error: 'invalid_token' }, { status: 401 });

    if (params?.id && String(params.id) !== String(ver.entryId)) {
      return NextResponse.json({ error: 'mismatched_entry_id' }, { status: 409 });
    }

    const admin = supabaseAdmin();
    const { data: entry, error: entryErr } = await admin
      .from('entries')
      .select('id,title,sale_type,token_id,edition_total,edition_sold')
      .eq('id', ver.entryId)
      .maybeSingle();

    if (entryErr) console.error('[claim] entries lookup error', entryErr, { entryId: ver.entryId });
    if (!entry) return NextResponse.json({ error: 'entry_not_found', details: { entryId: ver.entryId } }, { status: 404 });

    const saleType = String(entry.sale_type ?? '').toLowerCase();
    if (saleType !== 'nft') return NextResponse.json({ error: 'not_nft_entry' }, { status: 409 });

    const maxRemain =
      typeof entry.edition_total === 'number' && typeof entry.edition_sold === 'number'
        ? Math.max(0, Number(entry.edition_total) - Number(entry.edition_sold))
        : 1;
    if (maxRemain <= 0) return NextResponse.json({ error: 'sold_out' }, { status: 409 });

    // A) email モード
    if (mode === 'email') {
      const toEmail: string = String(body?.email ?? '').trim();
      if (!EMAIL_RE.test(toEmail)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

      const baseUrl = getBaseUrl(req);
      if (!baseUrl) return NextResponse.json({ error: 'server_misconfig_baseurl' }, { status: 500 });
      const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
      if (!ADMIN_API_TOKEN) return NextResponse.json({ error: 'server_misconfig_admin_token' }, { status: 500 });

      const buyerName: string = (typeof body?.name === 'string' && body.name.trim()) || 'ご購入者様';
      const claimUrl = `${baseUrl}/cert/${entry.id}?t=${encodeURIComponent(certToken)}`;
      const emailRes = await fetch(`${baseUrl}/api/send-email/purchaseNft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-meish-admin-token': ADMIN_API_TOKEN },
        body: JSON.stringify({ to: toEmail, name: buyerName, title: entry.title ?? 'ご購入作品', tokenId: entry.token_id ?? 0, claimUrl }),
      });
      if (!emailRes.ok) {
        const text = await emailRes.text().catch(() => '');
        console.error('[claim][email] send failed:', emailRes.status, text);
        return NextResponse.json({ error: 'email_send_failed' }, { status: 502 });
      }
      return NextResponse.json({ ok: true, mode: 'email', message: '受け取り用のメールを送信しました' });
    }

    // B) address モード
    const toRaw: string = body?.to ?? body?.address ?? '';
    const to = sanitizeTo(toRaw);
    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) return NextResponse.json({ error: 'invalid_to' }, { status: 400 });

    const tokenId =
      body?.tokenId != null ? Number(body.tokenId) :
      entry.token_id != null ? Number(entry.token_id) : NaN;
    if (!Number.isFinite(tokenId)) return NextResponse.json({ error: 'invalid_token_id' }, { status: 400 });

    const desired = body?.quantity != null ? Number(body.quantity) : 1;
    const quantity = Math.max(1, Math.min(desired, maxRemain));

    // ===== Thirdweb 準備 =====
    const chainEnv = process.env.CHAIN_NAME || '';
    const chain = normalizeChainName(chainEnv);
    const privateKey =
      process.env.MEISH_WALLET_PRIVATE_KEY ||
      process.env.THIRDWEB_PRIVATE_KEY ||
      '';
    const secretKey = process.env.THIRDWEB_SECRET_KEY || '';
    const rpcUrl = process.env.AMOY_RPC_URL || '';
    const contractAddress = process.env.NFT_1155_CONTRACT_ADDRESS || '';
    const usingPkVar = process.env.MEISH_WALLET_PRIVATE_KEY ? 'MEISH_WALLET_PRIVATE_KEY'
                      : process.env.THIRDWEB_PRIVATE_KEY ? 'THIRDWEB_PRIVATE_KEY' : 'NONE';

    if (!chain || !privateKey || !secretKey || !contractAddress) {
      console.error('[claim] misconfig', { chainEnv, hasPK: !!privateKey, hasSK: !!secretKey, contractAddress, usingPkVar });
      return NextResponse.json({ error: 'server_misconfig' }, { status: 500 });
    }
    if (!privateKey.startsWith('0x')) return NextResponse.json({ error: 'bad_private_key' }, { status: 500 });
    if (chain !== 'amoy') return NextResponse.json({ error: 'wrong_chain' }, { status: 409 });

    console.info('[claim] will send', { chain, contractAddress, usingPkVar, entryId: entry.id, tokenId, quantity, to });
    console.info('[claim] using rpc', { head: (rpcUrl || '').slice(0, 40) + '...' });

    // ---- RPC候補 ----
    const rpcCandidates = [
      rpcUrl,
      'https://rpc-amoy.polygon.technology',
      'https://polygon-amoy-bor.publicnode.com',
    ].filter(Boolean);

    // ---- RPCごとの実行関数（claimTo → 失敗時 airdrop フォールバック）----
    const runClaim = async (rpc: string) => {
      const chainObj = { slug: 'polygon-amoy', chainId: 80002, nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 }, rpc: [rpc] } as const;
      const sdk = ThirdwebSDK.fromPrivateKey(privateKey, chainObj as any, {
        secretKey, clientId: process.env.THIRDWEB_CLIENT_ID, rpcBatchSettings: { sizeLimit: 1, timeLimit: 0 },
      });
      // 送信者ウォレット（このPKが指すアドレス）
const signerAddr = await (await sdk.getSigner())?.getAddress();
console.info('[claim] resolved context', {
  sender: signerAddr,         // ← 実際にトランザクションを送るアドレス
  contractAddress,            // ← 呼び出し先（ENVのNFT_1155_CONTRACT_ADDRESS）
});

      const contract = await sdk.getContract(contractAddress, 'edition-drop');
      // （参考）MINTERロールを持っているかをログ出力（失敗しても処理は続行）
try {
  // thirdweb SDKのバージョン差を吸収して両方トライ
  const rolesApi: any = (contract as any).roles;
  let hasMinter: boolean | null = null;

  if (rolesApi?.getAll) {
    const all = await rolesApi.getAll().catch(() => null);
    const minters = all?.minter || all?.MINTER || [];
    hasMinter = Array.isArray(minters)
      ? minters.some((a: string) => a?.toLowerCase?.() === signerAddr?.toLowerCase?.())
      : null;
  } else if (rolesApi?.get) {
    const minters = await rolesApi.get('minter').catch(() => null);
    hasMinter = Array.isArray(minters)
      ? minters.some((a: string) => a?.toLowerCase?.() === signerAddr?.toLowerCase?.())
      : null;
  }

  console.info('[claim] role snapshot', { hasMinter });
} catch (e) {
  console.warn('[claim] role snapshot failed (non-fatal)', { message: (e as any)?.message });
}

      console.info('[claim] contract ready', { type: 'edition-drop', address: contractAddress, rpc });

      // token存在
      try { await contract.erc1155.get(tokenId as number); }
      catch { return NextResponse.json({ error: 'token_not_minted' }, { status: 409 }); }

      // precheck（落ちる環境はスキップ）
      let precheckSkipped = false;
      try { await contract.erc1155.claimConditions.getAll(tokenId as number); }
      catch (e: any) {
        precheckSkipped = true;
        console.warn('[claim] claimConditions.getAll failed, skip precheck and proceed', { code: e?.code, message: e?.message, rpc });
      }

      if (!precheckSkipped) {
        let reasons: string[] = [];
        try {
          reasons = await getClaimIneligibilityReasonsCompat(contract, tokenId as number, quantity, to);
        } catch {}
        if (Array.isArray(reasons) && reasons.length === 1 && (reasons[0] || '').toLowerCase().includes('no claim conditions')) {
          console.warn('[claim] auto-heal: set public free claim condition for token', { tokenId, rpc });
          await contract.erc1155.claimConditions.set(tokenId as number, [{
            startTime: new Date(Date.now() - 60_000),
            price: '0',
            currencyAddress: NATIVE_TOKEN_ADDRESS,
            maxClaimableSupply: 'unlimited',
            maxClaimablePerWallet: 'unlimited',
            waitInSeconds: 0,
            snapshot: null,
            metadata: {},
          }]);
          try { const after = await contract.erc1155.claimConditions.getAll(tokenId as number);
            console.info('[claim] auto-heal set done', { count: Array.isArray(after) ? after.length : 0, rpc });
          } catch {}
        } else if (reasons && reasons.length) {
          console.warn('[claim] ineligible', { reasons, rpc });
          return NextResponse.json({ error: 'ineligible', reasons }, { status: 409 });
        }
      }

      // === まずは claimTo を試行 ===
      try {
        const txRes = await contract.erc1155.claimTo(to, tokenId, quantity);
        const txhash = txRes.receipt.transactionHash;

        // edition_sold 加算（非致命）
        try {
          if (typeof entry.edition_sold === 'number') {
            await admin.from('entries').update({ edition_sold: Number(entry.edition_sold) + quantity }).eq('id', entry.id);
          }
        } catch (e) { console.warn('[claim] post update failed (non-fatal):', e); }

        return NextResponse.json({ ok: true, mode: 'address', entryId: entry.id, tokenId, quantity, txhash });
      } catch (e: any) {
        const m = String(e?.message || '').toLowerCase();
        const isNodeFail = m.includes('missing response') || m.includes('call_exception') || m.includes('server_error');
        console.warn('[claim] claimTo failed, consider airdrop fallback', { rpc, code: e?.code, message: e?.message });

        // === フォールバック: airdrop（管理者ミントで直接配布） ===
        // ※ MINTER 権限が無いと失敗します。通常、あなたの deploy/admin ウォレットならOK。
        try {
          if (isNodeFail) {
            console.info('[claim] try airdrop fallback', { rpc, to, tokenId, quantity });
            await contract.erc1155.airdrop(tokenId as number, [{ recipient: to, quantity } as any]); // SDKの型差異を吸収
            // airdrop はトランザクションハッシュが返らないことがあるので、直後に直近Txを拾えない限り省略
            try {
              if (typeof entry.edition_sold === 'number') {
                await admin.from('entries').update({ edition_sold: Number(entry.edition_sold) + quantity }).eq('id', entry.id);
              }
            } catch (ee) { console.warn('[claim] post update failed (non-fatal):', ee); }

            return NextResponse.json({ ok: true, mode: 'address', entryId: entry.id, tokenId, quantity, via: 'airdrop' });
          }
          throw e;
        } catch (airErr: any) {
          console.error('[claim] airdrop fallback failed', { rpc, code: airErr?.code, message: airErr?.message });
          throw e; // 元のエラーに委ねる（次のRPC候補へ）
        }
      }
    };

    // ---- RPCフォールバック実行 ----
    let lastErr: any = null;
    for (const candidate of rpcCandidates) {
      try {
        console.info('[claim] try rpc', { rpc: candidate });
        return await runClaim(candidate);
      } catch (e: any) {
        lastErr = e;
        const m = String(e?.message || '').toLowerCase();
        if (m.includes('missing response') || m.includes('call_exception') || m.includes('server_error')) {
          console.warn('[claim] rpc failed, fallback...', { rpc: candidate, message: e?.message });
          continue;
        }
        throw e;
      }
    }
    throw lastErr || new Error('all rpc failed');

  } catch (e: any) {
    const err = { name: e?.name, message: e?.message, reason: e?.reason, shortMessage: e?.shortMessage, code: e?.code };
    console.error('[claim] tx error', err);

    const msg = String(e?.message || '').toLowerCase();
    if (e?.code === 'CALL_EXCEPTION') return NextResponse.json({ error: 'no_claim_condition' }, { status: 409 });
    if (e?.code === 'INSUFFICIENT_FUNDS' || msg.includes('insufficient funds')) return NextResponse.json({ error: 'insufficient_gas' }, { status: 402 });
    if (msg.includes('no claim condition') || msg.includes('no active claim condition')) return NextResponse.json({ error: 'no_claim_condition' }, { status: 409 });
    if (msg.includes('not minted') || (msg.includes('token') && msg.includes('does not exist'))) return NextResponse.json({ error: 'token_not_minted' }, { status: 409 });
    if (msg.includes('exceeds') && msg.includes('max')) return NextResponse.json({ error: 'quantity_exceeds_max' }, { status: 409 });
    if (msg.includes('chain') && msg.includes('mismatch')) return NextResponse.json({ error: 'wrong_chain' }, { status: 409 });
    if (msg.includes('could not connect') || msg.includes('timeout') || msg.includes('network') || msg.includes('missing response')) {
      return NextResponse.json({ error: 'rpc_unavailable' }, { status: 502 });
    }
    return NextResponse.json({ error: 'tx_failed' }, { status: 500 });
  }
}

