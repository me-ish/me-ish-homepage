// --- /app/api/purchase/nft-transfer/route.ts ---
import { NextRequest, NextResponse } from 'next/server';
import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const sdk = ThirdwebSDK.fromPrivateKey(
  process.env.THIRDWEB_PRIVATE_KEY!,
  'polygon' // Mumbaiなら 'mumbai'
);

const contractAddress = process.env.NFT_CONTRACT_ADDRESS!;
const fromWallet = process.env.MEISH_WALLET_ADDRESS!;
const resend = new Resend(process.env.RESEND_API_KEY!);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { email, entryId, name, imageUrl } = await req.json();

  if (!email || !entryId || !name || !imageUrl) {
    return NextResponse.json({ error: '必須情報が不足しています' }, { status: 400 });
  }

  try {
    // ✅ 1. NFTをmint
    const contract = await sdk.getContract(contractAddress);
    const tx = await contract.erc721.mintTo(fromWallet, {
      name,
      image: imageUrl,
    });

    const nftId = tx.id.toString();
    const nftUrl = `https://thirdweb.com/polygon/${contractAddress}/${nftId}`;

    // ✅ 2. Resendでメール送信
    await resend.emails.send({
      from: 'me-ish <noreply@me-ish.art>',
      to: email,
      subject: 'NFT作品のお届け：me-ish',
      html: `
        <p>このたびはNFT作品をご購入いただきありがとうございます。</p>
        <p>以下のリンクからNFTをご確認いただけます。</p>
        <p><a href="${nftUrl}">${nftUrl}</a></p>
        <p>（ウォレット連携またはThirdwebアカウントで閲覧可能です）</p>
      `,
    });

    // ✅ 3. salesテーブルにnft_urlを保存（オプション）
    const { error: updateError } = await supabase
      .from('sales')
      .update({ nft_url: nftUrl })
      .eq('entry_id', entryId);

    if (updateError) {
      console.error('sales更新エラー:', updateError.message);
    }

    return NextResponse.json({ success: true, nftUrl });
  } catch (err: any) {
    console.error('❌ NFT mintエラー:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
