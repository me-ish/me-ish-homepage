import Link from "next/link";

export default function CoAIndex() {
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center" }}>
      <div>
        <p>このページは注文ID付きでアクセスしてください。</p>
        <p style={{ marginTop: 8 }}>
          通常作品（ダウンロード）例：{" "}
          <Link href="/cert/123?entry=123&t=EXAMPLETOKEN">/cert/123?entry=123&t=EXAMPLETOKEN</Link>
        </p>
        <p>
          NFT 例：{" "}
          <Link href="/cert/123?type=nft&tokenId=0&qty=1&t=EXAMPLETOKEN">/cert/123?type=nft&tokenId=0&qty=1&t=EXAMPLETOKEN</Link>
        </p>
        <p style={{ marginTop: 8, color: "#888", fontSize: 12 }}>
          ※ <code>entry</code> が付いていれば通常作品として表示されます（<code>type</code> は不要）。
        </p>
      </div>
    </main>
  );
}
