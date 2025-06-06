// --- /lib/mintNftForPurchase.ts ---
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { Resend } from "resend";

export async function mintNftForPurchase(email: string, metadata: any) {
  const sdk = new ThirdwebSDK("polygon"); // or "mumbai"
  const wallet = await sdk.wallet.connect(process.env.PRIVATE_KEY!);
  const contract = await sdk.getContract(process.env.NFT_CONTRACT_ADDRESS!);

  // Mint処理（metadataに tokenId や URI が含まれている前提）
  const tx = await contract.erc721.mintTo(process.env.MEISH_WALLET!, {
    name: metadata.name,
    image: metadata.image,
  });

  const url = `https://thirdweb.com/mumbai/${process.env.NFT_CONTRACT_ADDRESS}/${tx.id}`;

  // Resendでメール送信
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'me-ish <noreply@me-ish.art>',
    to: email,
    subject: 'NFT作品のご購入ありがとうございます',
    html: `<p>NFTをmintしました！以下のリンクからご確認いただけます：</p><p><a href="${url}">${url}</a></p>`,
  });
}