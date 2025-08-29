// src/lib/mintNftForPurchase.ts
import 'server-only';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { Resend } from 'resend';

type MintMeta = { name: string; image: string };

const CHAIN = process.env.CHAIN_NAME || 'polygon'; // 'polygon' | 'mumbai' など
const PRIVATE_KEY = process.env.THIRDWEB_PRIVATE_KEY!;       // 必須
const SECRET_KEY  = process.env.THIRDWEB_SECRET_KEY!;        // 必須（←これがないと「No API key」になります）
const CONTRACT    = process.env.NFT_CONTRACT_ADDRESS!;       // 必須
const MINT_TO     = process.env.MEISH_WALLET_ADDRESS!;       // 送付先ウォレット
const RESEND_KEY  = process.env.RESEND_API_KEY!;             // Resend

// SDK はプロセス内で 1 回だけ初期化
const sdk = ThirdwebSDK.fromPrivateKey(PRIVATE_KEY, CHAIN as any, { secretKey: SECRET_KEY });
const contractP = sdk.getContract(CONTRACT); // Promise をキャッシュ

const resend = new Resend(RESEND_KEY);

/** 購入確定後に NFT を mint し、確認メール（失敗しても処理は成功扱い）を送る */
export async function mintNftForPurchase(email: string, metadata: MintMeta) {
  if (!metadata?.name || !metadata?.image) {
    throw new Error('metadata.name と metadata.image は必須です');
  }

  const contract = await contractP;

  // mintTo: 受け取り先(MINT_TO)へ直接ミント
  const mintTx = await contract.erc721.mintTo(MINT_TO, {
    name: metadata.name,
    image: metadata.image,
  });

  const tokenId = mintTx.id.toString();
  const txhash  = mintTx.receipt.transactionHash;

  // thirdweb の閲覧 URL（選択チェーンと揃える）
  const nftUrl = `https://thirdweb.com/${CHAIN}/${CONTRACT}/${tokenId}`;

  // メールは失敗しても throw しない（ログのみ）
  try {
    await resend.emails.send({
      from: 'me-ish <noreply@me-ish.art>',
      to: email,
      subject: '【me-ish】NFTを鋳造しました',
      html: `
        <p>NFT（Token ID: #${tokenId}）を作成しました。</p>
        <p><a href="${nftUrl}">${nftUrl}</a></p>
        <p>ウォレット受け取りや転送方法は追ってご案内いたします。</p>
      `,
    });
  } catch (e) {
    console.warn('[mintNftForPurchase] email failed:', e);
  }

  return { ok: true, tokenId, txhash, nftUrl };
}
