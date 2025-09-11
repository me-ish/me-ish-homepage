import Link from "next/link";

export default function CoAIndex() {
  return (
    <main style={{minHeight:"60vh",display:"grid",placeItems:"center",textAlign:"center"}}>
      <div>
        <p>このページは注文ID付きでアクセスしてください。</p>
        <p>例）<Link href="/cert/123?type=nft&tokenId=0&qty=1">/cert/123?type=nft&tokenId=0&qty=1</Link></p>
      </div>
    </main>
  );
}
