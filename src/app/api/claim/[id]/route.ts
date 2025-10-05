// /src/app/api/claim/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";

/** ====== 環境・共通ユーティリティ ====== */
const EDITION_DROP_ADDRESS =
  process.env.NEXT_PUBLIC_EDITION_DROP_ADDRESS ??
  "0xaF4dB4A95a8CC61A4D03e8fD9183FB539B129a17";

// OpenZeppelin AccessControl: keccak256("MINTER_ROLE")
const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

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
  const edition = await sdk.getContract(EDITION_DROP_ADDRESS, "edition-drop");
  return { sdk, edition };
}

const isEthAddress = (x: string | undefined): x is string =>
  !!x && /^0x[a-fA-F0-9]{40}$/.test(x.trim());

/** entryId→配布パラメータ解決（用途に合わせてDBに差し替え） */
async function resolveAirdropParams(entryId: number) {
  const tokenId = 1;
  const quantity = "1";
  return { tokenId, quantity };
}

/** 直接 hasRole を叩いて MINTER を判定（列挙APIは使わない） */
async function hasMinterRole(edition: any, address: string): Promise<boolean> {
  try {
    const ok = await edition.call("hasRole", [MINTER_ROLE, address]);
    return Boolean(ok);
  } catch {
    return false;
  }
}

/** ====== GET: プリフライト ====== */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const entryId = Number(ctx.params.id);
    if (!Number.isFinite(entryId)) return json(400, { ok: false, error: "invalid entry id" });

    const { tokenId } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();

    const sender = await sdk.getSigner()!.getAddress();

    // ★ 列挙を廃止して hasRole を直接呼ぶ
    const hasMinter = await hasMinterRole(edition, sender);

    // token 存在チェック（v5: erc1155.get）
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

    const { tokenId, quantity } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();

    // ★ サーバーウォレットの MINTER を hasRole で判定
    const sender = await sdk.getSigner()!.getAddress();
    const hasMinter = await hasMinterRole(edition, sender);
    if (!hasMinter) return json(403, { ok: false, error: "Server wallet has no MINTER_ROLE" });

    // token の存在（LazyMint済み）確認
    try {
      await edition.erc1155.get(tokenId);
    } catch {
      return json(400, { ok: false, error: `Token #${tokenId} is not lazy-minted` });
    }

    if (mode === "email") {
      // TODO: 受け取りリンクメール送信に接続
      return json(200, { ok: true, message: "受け取りリンクをメールで送信しました。" });
    }

    // mode === "address": airdrop 実行
    const to = body?.address?.trim();
    if (!isEthAddress(to)) return json(400, { ok: false, error: "Invalid recipient address" });

    // v5: erc1155.airdrop(tokenId, [{ address, quantity }])
    const result = await edition.erc1155.airdrop(tokenId, [{ address: to, quantity }]);

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

