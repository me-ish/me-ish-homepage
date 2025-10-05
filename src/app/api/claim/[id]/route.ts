// /src/app/api/claim/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";

/** ====== 環境・共通ユーティリティ ====== */
const EDITION_DROP_ADDRESS =
  process.env.NEXT_PUBLIC_EDITION_DROP_ADDRESS ??
  "0xaF4dB4A95a8CC61A4D03e8fD9183FB539B129a17";

function json(status: number, data: any) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function assertEnv() {
  const pk = process.env.MEISH_WALLET_PRIVATE_KEY;
  const secret = process.env.THIRDWEB_SECRET_KEY;
  const miss: string[] = [];
  if (!pk) miss.push("MEISH_WALLET_PRIVATE_KEY");
  if (!secret) miss.push("THIRDWEB_SECRET_KEY");
  if (!EDITION_DROP_ADDRESS) miss.push("NEXT_PUBLIC_EDITION_DROP_ADDRESS");
  if (miss.length) throw new Error(`Missing env: ${miss.join(", ")}`);
  if (!pk!.startsWith("0x")) throw new Error("MEISH_WALLET_PRIVATE_KEY must start with 0x");
}

function getServerSDK() {
  assertEnv();
  return ThirdwebSDK.fromPrivateKey(
    process.env.MEISH_WALLET_PRIVATE_KEY!, // サーバーウォレット（MINTER想定）
    PolygonAmoyTestnet,
    { secretKey: process.env.THIRDWEB_SECRET_KEY }
  );
}

async function getEditionDrop() {
  const sdk = getServerSDK();
  // 型は "edition-drop" を明示して取得（roles/erc1155 の両方が生える）
  const edition = await sdk.getContract(EDITION_DROP_ADDRESS, "edition-drop");
  return { sdk, edition };
}

const isEthAddress = (x: string | undefined): x is string =>
  !!x && /^0x[a-fA-F0-9]{40}$/.test(x.trim());

/** ====== （例）entryId→配布パラメータ解決 ======
 * 実運用では DB から entryId に紐づく tokenId / quantity を取得してください。
 * ここでは暫定で tokenId=1, quantity="1" を返します。
 */
async function resolveAirdropParams(entryId: number) {
  // TODO: Supabaseから取得
  const tokenId = 1;
  const quantity = "1";
  return { tokenId, quantity };
}

/** ====== GET: プリフライト ======
 * サーバーウォレットが MINTER を持つか & tokenId が Lazy Mint 済みか を返す
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const entryId = Number(ctx.params.id);
    if (!Number.isFinite(entryId)) return json(400, { ok: false, error: "invalid entry id" });

    const { tokenId } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();

    const sender = await sdk.getSigner()!.getAddress();

    // Roles（v5でOK）
    const roles = await edition.roles.getAll(); // { admin:[], minter:[], transfer:[] }
    const hasMinter =
      roles.minter?.some((a: string) => a.toLowerCase() === sender.toLowerCase()) ?? false;

    // ✅ v5 では getTokenMetadata ではなく erc1155.get(tokenId)
    let tokenExists = false;
    try {
      const nft = await edition.erc1155.get(tokenId);
      tokenExists = Boolean(nft?.metadata);
    } catch {
      tokenExists = false;
    }

    return json(200, {
      ok: true,
      sender,
      hasMinter,
      tokenExists,
      tokenId,
      contract: EDITION_DROP_ADDRESS,
      chain: "polygon-amoy",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message ?? "preflight failed" });
  }
}

/** ====== POST: airdrop 実行（or emailフロー） ====== */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const entryId = Number(ctx.params.id);
    const body = (await req.json().catch(() => ({}))) as {
      mode?: "address" | "email";
      address?: string;
      email?: string;
      token?: string;
    };
    const mode = body?.mode ?? "address";

    // トークン認証が必要ならここでチェック
    // if (!body.token) return json(401, { ok:false, error:"missing token" });

    const { tokenId, quantity } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();

    // サーバーウォレットの MINTER 確認
    const sender = await sdk.getSigner()!.getAddress();
    const roles = await edition.roles.getAll();
    const hasMinter =
      roles.minter?.some((a: string) => a.toLowerCase() === sender.toLowerCase()) ?? false;
    if (!hasMinter) return json(403, { ok: false, error: "Server wallet has no MINTER_ROLE" });

    // token の存在チェック（LazyMint 済みか）
    try {
      await edition.erc1155.get(tokenId);
    } catch {
      return json(400, { ok: false, error: `Token #${tokenId} is not lazy-minted` });
    }

    if (mode === "email") {
      // 受け取りリンクメール送信など既存ワークフローに接続
      return json(200, { ok: true, message: "受け取りリンクをメールで送信しました。" });
    }

    // mode === "address": airdrop 実行
    const to = body?.address?.trim();
    if (!isEthAddress(to)) return json(400, { ok: false, error: "Invalid recipient address" });

    /** ✅ v5 正式シグネチャ
     *  erc1155.airdrop(tokenId, [{ address, quantity }])
     *  ※ quantity は string/number どちらでもOK
     */
    const result = await edition.erc1155.airdrop(tokenId, [{ address: to, quantity }]);

    // 返り値が単体 or 配列の両対応で txHash を抽出
    const txArray = Array.isArray(result) ? result : [result];
    const txHash =
      txArray[0]?.receipt?.transactionHash ??
      (txArray[0] as any)?.transactionHash ??
      undefined;

    return json(200, {
      ok: true,
      message: "配布トランザクションを送信しました。",
      txHash,
      tokenId,
      to,
      sender,
      contract: EDITION_DROP_ADDRESS,
    });
  } catch (e: any) {
    const msg: string = e?.reason || e?.shortMessage || e?.message || "claim/airdrop failed";
    return json(500, { ok: false, error: msg });
  }
}

