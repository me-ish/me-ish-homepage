// /src/app/api/claim/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";

/** ========= 環境 ========= */
const EDITION_DROP_ADDRESS =
  process.env.NEXT_PUBLIC_EDITION_DROP_ADDRESS ??
  "0xaF4dB4A95a8CC61A4D03e8fD9183FB539B129a17";

// OpenZeppelin AccessControl: keccak256("MINTER_ROLE")
const MINTER_ROLE =
  "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";

/** ========= 小ユーティリティ ========= */
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
  // 型は edition-drop を明示（roles/erc1155 が利用可）
  const edition = await sdk.getContract(EDITION_DROP_ADDRESS, "edition-drop");
  return { sdk, edition };
}

const isEthAddress = (x: string | undefined): x is string =>
  !!x && /^0x[a-fA-F0-9]{40}$/.test(x.trim());

/**
 * entryId → 配布パラメータ解決
 * 実運用では DB（Supabase等）から tokenId / quantity を引いてください。
 */
async function resolveAirdropParams(entryId: number) {
  // TODO: Supabaseから取得
  const tokenId = 1;
  const quantity = "1";
  return { tokenId, quantity };
}

/** ベストエフォートの MINTER 判定（参考値としてのみ使用） */
async function tryVerifyMinter(edition: any, account: string): Promise<boolean | null> {
  try {
    // 最優先：thirdweb v5 の verify
    if (await edition.roles.verify(["minter"], account)) return true;
  } catch {}
  try {
    // IPermissions拡張
    const r = await edition.call("hasAllRoles", [account, [MINTER_ROLE]]);
    if (r === true || r === 1 || String(r) === "true") return true;
  } catch {}
  try {
    // 標準 AccessControl（順序1）
    const r = await edition.call("hasRole", [MINTER_ROLE, account]);
    if (r === true || r === 1 || String(r) === "true") return true;
  } catch {}
  try {
    // 標準 AccessControl（順序2）
    const r = await edition.call("hasRole", [account, MINTER_ROLE]);
    if (r === true || r === 1 || String(r) === "true") return true;
  } catch {}
  // 判定APIが使えない/失敗する場合は null（不明）を返す
  return false;
}

/** ========= GET: プリフライト =========
 * ・tokenId が Lazy Mint 済みか（必須）
 * ・サーバーウォレットのアドレス（sender）
 * ・hasMinter は参考値（falseでもUIはブロックしない想定／POSTでsimulate判定）
 */
export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const entryId = Number(ctx.params.id);
    if (!Number.isFinite(entryId)) return json(400, { ok: false, error: "invalid entry id" });

    const { tokenId } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();

    const sender = await sdk.getSigner()!.getAddress();

    // token存在チェック（必須）
    let tokenExists = false;
    try {
      const nft = await edition.erc1155.get(tokenId);
      tokenExists = Boolean(nft?.metadata);
    } catch {
      tokenExists = false;
    }

    // 参考値としての hasMinter（失敗してもUIはブロックしない）
    let hasMinter: boolean | null = null;
    try {
      hasMinter = await tryVerifyMinter(edition, sender);
    } catch {
      hasMinter = null;
    }

    return json(200, {
      ok: true,
      sender,
      hasMinter, // 参考値
      tokenExists,
      tokenId,
      contract: EDITION_DROP_ADDRESS,
      chain: "polygon-amoy",
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message ?? "preflight failed" });
  }
}

/** ========= POST: airdrop 実行（simulate→本送信） =========
 * payload: { mode: "address" | "email", address?: string, email?: string, token?: string }
 * - mode==="address" のときのみチェーンへ送信
 * - 実送信前に prepare().simulate() で“本当に通るか”を確定
 */
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

    // 必要なら body.token 検証などをここに

    const { tokenId, quantity } = await resolveAirdropParams(entryId);
    const { sdk, edition } = await getEditionDrop();
    const sender = await sdk.getSigner()!.getAddress();

    // token の存在（LazyMint 済み）確認
    try {
      await edition.erc1155.get(tokenId);
    } catch {
      return json(400, { ok: false, error: `Token #${tokenId} is not lazy-minted` });
    }

    if (mode === "email") {
      // TODO: 受け取りリンクの発行・メール送信に接続
      return json(200, { ok: true, message: "受け取りリンクをメールで送信しました。" });
    }

    // ---- airdrop（address直送） ----
    const to = body?.address?.trim();
    if (!isEthAddress(to)) return json(400, { ok: false, error: "Invalid recipient address" });

    // 1) 送信前シミュレーション（eth_call）
    try {
      // v5: prepare → simulate
      const prepared = await edition.erc1155.airdrop.prepare(tokenId, [{ address: to, quantity }]);
      await prepared.simulate(); // ここで MINTER なしや各種 revert が確定的に分かる
    } catch (e: any) {
      const msg = e?.reason || e?.shortMessage || e?.message || "";
      // 人間向けに代表的なエラーを整形
      if (/AccessControl|Permissions|missing role|not authorized/i.test(msg)) {
        return json(403, {
          ok: false,
          error: "サーバーウォレットに MINTER 権限がありません（Roles で付与してください）。",
          detail: msg,
          sender,
        });
      }
      if (/paused|not active|claim/i.test(msg)) {
        return json(400, { ok: false, error: "現在このトークンは配布できません。設定をご確認ください。", detail: msg });
      }
      return json(400, { ok: false, error: msg || "airdrop simulate failed" });
    }

    // 2) シミュ成功 → 本送信
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

