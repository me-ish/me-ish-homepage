// /src/lib/thirdwebServer.ts
import { ThirdwebSDK } from "@thirdweb-dev/sdk";
import { PolygonAmoyTestnet } from "@thirdweb-dev/chains";

export function getServerSDK() {
  const pk = process.env.MEISH_WALLET_PRIVATE_KEY!;
  const secretKey = process.env.THIRDWEB_SECRET_KEY!;
  if (!pk?.startsWith("0x")) throw new Error("MEISH_WALLET_PRIVATE_KEY malformed");

  return ThirdwebSDK.fromPrivateKey(pk, PolygonAmoyTestnet, { secretKey });
}
