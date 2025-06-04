// app/buyers/page.tsx

'use client';

export default function BuyersPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#333] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">
        ギャラリーへの参加・購入方法
      </h1>

      {/* 概要 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-3">me-ishで作品を楽しみ、購入するには</h2>
        <p>
          me-ishでは、どなたでも3D空間で展示された作品を自由に鑑賞できます。  
          気に入った作品があれば、その場で購入することも可能です。販売形式は「通常販売（円建て）」と「NFT販売」の2種類があります。
        </p>
      </section>

{/* 通常販売（円での購入）の流れ */}
<section className="mb-16">
  <h2 className="text-2xl font-bold mb-6 text-center">通常販売（円での購入）の流れ</h2>

  <div className="space-y-6">
    {/* Step 1 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        1
      </div>
      <div>
        <p className="font-bold">作品をクリック</p>
        <p className="text-sm text-gray-600">展示中の作品をクリックして詳細を表示します</p>
      </div>
    </div>

    {/* Step 2 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        2
      </div>
      <div>
        <p className="font-bold">内容を確認</p>
        <p className="text-sm text-gray-600">価格・販売形式・作家情報をチェックします</p>
      </div>
    </div>

    {/* Step 3 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        3
      </div>
      <div>
        <p className="font-bold">決済を完了</p>
        <p className="text-sm text-gray-600">Stripe経由でクレジットカード決済が可能です</p>
      </div>
    </div>

    {/* Step 4 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        4
      </div>
      <div>
        <p className="font-bold">データを受け取る</p>
        <p className="text-sm text-gray-600">購入完了後、作品データがメールで届きます</p>
      </div>
    </div>
  </div>
</section>


{/* NFT販売の流れ */}
<section className="mb-16">
  <h2 className="text-2xl font-bold mb-6 text-center">NFT販売の流れ</h2>

  <div className="space-y-6">
    {/* Step 1 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        1
      </div>
      <div>
        <p className="font-bold">NFT作品を選ぶ</p>
        <p className="text-sm text-gray-600">「NFT販売」と表示された作品をクリックします</p>
      </div>
    </div>

    {/* Step 2 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        2
      </div>
      <div>
        <p className="font-bold">支払い方法を選択</p>
        <p className="text-sm text-gray-600">ウォレット or クレカ（Paper連携）で購入できます</p>
      </div>
    </div>

    {/* Step 3 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        3
      </div>
      <div>
        <p className="font-bold">me-ishがmint</p>
        <p className="text-sm text-gray-600">購入者の名義でNFTを発行し、ウォレットに送信します</p>
      </div>
    </div>

    {/* Step 4 */}
    <div className="flex items-start space-x-4">
      <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
        4
      </div>
      <div>
        <p className="font-bold">証明付きで保有</p>
        <p className="text-sm text-gray-600">NFTとあわせて、保護済み画像もメールで届きます</p>
      </div>
    </div>
  </div>
</section>


      {/* 保護処理について */}
      <section className="mb-16">
        <h2 className="text-xl font-bold mb-3">作品の保護と真正性の証明</h2>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          <li>すべての作品にはウォーターマーク・Glaze・ステガノグラフィー等のAI学習防止処理が施されています</li>
          <li>購入者には、<strong>保護済み画像</strong>と<strong>元画像（無加工）</strong>の両方をお渡しします</li>
          <li>NFT販売では、me-ishのスマートコントラクトで発行された証明付きNFTがあなたのものになります</li>
        </ul>
      </section>

      {/* Q&A */}
      <section className="mb-16">
        <h2 className="text-xl font-bold mb-3">よくあるご質問</h2>
        <ul className="space-y-4 text-sm">
          <li>
            <strong>Q. ウォレットを持っていませんがNFTを買えますか？</strong><br />
            → はい。Paperという仕組みにより、メールアドレスだけでNFT購入・所有が可能です。
          </li>
          <li>
            <strong>Q. どんな形式のデータがもらえますか？</strong><br />
            → 購入後にメールで画像データ（保護済み＋原本）をお送りします。
          </li>
          <li>
            <strong>Q. AIで学習されませんか？</strong><br />
            → Glaze・ステガノグラフィーなど、AI学習を妨げる処理を全作品に行っております。
          </li>
        </ul>
      </section>

      {/* ギャラリー誘導 */}
      <div className="text-center mt-16">
        <a
          href="/gallery"
          className="inline-block bg-[#00a1e9] text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-[#008ec4] transition"
        >
          ギャラリーを見てみる
        </a>
      </div>
    </main>
  );
}
