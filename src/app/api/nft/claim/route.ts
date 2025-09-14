// /src/app/api/nft/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyCertToken } from "@/lib/coa/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** 簡易ユーティリティ */
function normalizeChain(name: string) {
  const n = (name || "").toLowerCase();
  if (n === "polygon" || n === "matic" || n === "mainnet") return "polygon";
  if (n === "amoy" || n === "polygon-amoy") return "amoy";
  if (n === "mumbai" || n === "polygon-mumbai") return "mumbai";
  return n || "polygon";
}
function isEthAddress(s?: string | null) {
  return !!s && /^0x[a-fA-F0-9]{40}$/.test(s);
}

type EntryNFTRow = {
  id: number;
  token_id?: string | number | null;        // ← ある場合は使う
  contract_address?: string | null;         // コントラクトをDBに持っているなら使う
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      to?: string;            // 受取先（必須）
      certToken?: string;     // CoAの?t=（必須）
      quantity?: number;      // デフォルト1（ERC-1155）
    };

    if (!body?.to || !isEthAddress(body.to)) {
      return NextResponse.json({ error: "invalid_to" }, { status: 400 });
    }
    const certToken = body?.certToken || "";
    const qty = Math.max(1, Number(body?.quantity ?? 1));

    // 1) CoAトークン検証 → entryId
    const ver = await verifyCertToken(certToken);
    if (!ver.ok) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    const entryId = ver.entryId;

    // 2) entries から必要最小限だけ取得（存在しない列は選ばない）
    const sb = supabaseAdmin();
    const { data: row, error: eErr } = await sb
      .from("entries")
      .select("id, contract_address")     // ← token_id がまだ無い環境でも型エラーにならない
      .eq("id", entryId)
      .maybeSingle();

    if (eErr || !row) {
      return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
    }

    // 3) tokenId の決定
    //    - 推奨：entries.token_id を使う
    //    - 一時回避：環境変数 TOKEN_ID_FROM_ENTRY_ID=1 なら entry.id を tokenId として使用
    const ent = row as unknown as EntryNFTRow;
    const useFallback = process.env.TOKEN_ID_FROM_ENTRY_ID === "1";
    const tokenId =
      ent.token_id ?? (useFallback ? ent.id : null);

    if (tokenId === null || tokenId === undefined || tokenId === "") {
      return NextResponse.json(
        { error: "token_id_missing", hint: "entries.token_id を用意するか TOKEN_ID_FROM_ENTRY_ID=1 を設定" },
        { status: 409 }
      );
    }

    // 4) thirdweb で ERC-1155 を transfer（ギャラリー→ユーザー）
    const CHAIN = normalizeChain(process.env.CHAIN_NAME || "");
    const PRIVATE_KEY = process.env.THIRDWEB_PRIVATE_KEY || "";
    const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "";
    const CONTRACT =
      ent.contract_address || process.env.NFT_CONTRACT_ADDRESS || "";

    if (!PRIVATE_KEY || !SECRET_KEY || !CONTRACT) {
      return NextResponse.json(
        { error: "server_misconfig", detail: "THIRDWEB_PRIVATE_KEY / THIRDWEB_SECRET_KEY / NFT_CONTRACT_ADDRESS" },
        { status: 500 }
      );
    }

    const sdk = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN as any, {
      secretKey: SECRET_KEY,
    });
    const contract = await sdk.getContract(CONTRACT);

    // ★ ERC-1155: transfer(to, tokenId, amount)
    const tx = await contract.erc1155.transfer(body.to, String(tokenId), qty);
    const txhash = tx?.receipt?.transactionHash;

    return NextResponse.json({
      ok: true,
      entryId,
      tokenId: String(tokenId),
      quantity: qty,
      txhash,
      network: CHAIN,
    });
  } catch (e: any) {
    console.error("[claim1155] error:", e);
    return NextResponse.json(
      { error: "internal_error", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
