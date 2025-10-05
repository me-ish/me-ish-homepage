// /src/app/api/claim/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";

/** ====== 環境 ====== */
const EDITION_DROP_ADDRESS =
  process.env.NEXT_PUBLIC_EDITION_DROP_ADDRESS ??
  "0xaF4dB4A95a8CC61A4D03e8fD9183FB539B129a17";

// OpenZeppelin AccessControl: keccak256("MINTER_ROLE")
const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

/** 共通: JSON返却 */
function json(status: number, data: any) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/** 環境チェック */
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

/** SDK 取得（サーバーウォレット＝MINTER想定） */
function getServerSDK() {
  assertEnv();
  return ThirdwebSDK.fromPrivateKey(
    process.env.MEISH_WALLET_PRIVATE_KEY!,
    PolygonAmoyTestnet,
    { secretKey: process.env.THIRDWEB_SECRET_KEY }
  );
}

/** Edition Drop 取得 */
async function getEditionDrop() {
  const sdk = getServerSDK();
  const edition = await sdk.getContract(EDITION_DROP_ADDRESS, "edition-drop");
  return { sdk, edition };
}

/** アドレス形式 */
const isEthAddress = (x: string | undefined): x is string =>
  !!x && /^0x[a-fA-F0-9]{40}$/.test(x.trim());

/** entryId -> 配布パラメータ解決（必要に応じてDBへ差し替え） */
async function resolveAirdropParams(entryId: number) {
  // TODO: Supabase等から entryId に紐づく tokenId / quantity を取得
  const tokenId = 1;
  const quantity = "1";
  return { tokenId, quantity };
}

/** robust: 版差に合わせて複数シグネチャを試す hasRole 判定 */
async function hasMinterRole(edition: any, account: string): Promise<boolean> {
  // 1) hasRole(bytes32 role, address account)
  try {
    const r = await edition.call("hasRole", [MINTER_ROLE, account]);
    if (typeof r === "boolean" && r) return true;
  } catch {}

  // 2) hasRole(address account, bytes32 role) 逆順
  try {
    const r = await edition.call("hasRole", [account, MINTER_ROLE]);
    if (typeof r === "boolean" && r) return true;
  } catch {}

  // 3) hasAllRoles(address account, bytes32[] roles) thirdweb IPermissions 実装
  try {
    const r = await edition.call("hasAllRoles", [account, [MINTER_ROLE]]);
    if (typeof r === "boolean" && r) return true;
  } catch {}

  return false;
}

/** ====== GET: プリフライト ======
 * - サーバーウォレットが MINTER を持つか
 * - tokenId が Lazy Mint 済みか
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const entryId = Number(ctx.params.id);
    if (!Number.isFinite(entryId)) return json(400, { ok: false, error: "invalid entry id" });

    const { tokenId } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();

    const sender = await sdk.getSigner()!.getAddress();
    const hasMinter = await hasMinterRole(edition, sender);

    // v5: token存在チェックは erc1155.get
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

    // 必要であればここで body.token の検証など

    const { tokenId, quantity } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();

    // サーバーウォレットの MINTER を判定
    const sender = await sdk.getSigner()!.getAddress();
    const hasMinter = await hasMinterRole(edition, sender);
    if (!hasMinter) return json(403, { ok: false, error: "Server wallet has no MINTER_ROLE" });

    // token の存在確認（LazyMint 済みか）
    try {
      await edition.erc1155.get(tokenId);
    } catch {
      return json(400, { ok: false, error: `Token #${tokenId} is not lazy-minted` });
    }

    if (mode === "email") {
      // TODO: メール受け取りワークフローへ接続（リンク生成・送信）
      return json(200, { ok: true, message: "受け取りリンクをメールで送信しました。" });
    }

    // mode === "address": 直送（airdrop）
    const to = body?.address?.trim();
    if (!isEthAddress(to)) return json(400, { ok: false, error: "Invalid recipient address" });

    /** v5 正式 airdrop
     * erc1155.airdrop(tokenId, [{ address, quantity }])
     */
    const result = await edition.erc1155.airdrop(tokenId, [{ address: to, quantity }]);

    // 単体/配列の両対応で txHash を抽出
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
