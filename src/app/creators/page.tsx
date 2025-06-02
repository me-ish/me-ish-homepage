// app/creators/page.tsx

'use client';

export default function CreatorsPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#333] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">
        出展をご希望の方へ
      </h1>

      {/* 概要 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-3">誰でも参加できる、安心のアート展示空間</h2>
        <p>
          me-ishでは、プロ・アマ問わずどなたでも作品を出展できます。
          NFT販売・通常販売に対応しており、アカウント不要で応募が可能です。
          出展時には、ウォーターマークやAI学習防止処理など、あなたの作品をしっかり守る対策も整えています。
        </p>
      </section>

      {/* 出展までの流れ（視覚的ステップUI） */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 text-center">出展までの流れ</h2>

        <div className="space-y-6">
          {/* Step 1 */}
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <p className="font-bold">応募フォームの送信</p>
              <p className="text-sm text-gray-600">作品画像・情報・販売形式などをフォームから提出します</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <p className="font-bold">運営による内容確認</p>
              <p className="text-sm text-gray-600">内容チェックと審査（1〜2営業日）を行います</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <p className="font-bold">画像の保護処理</p>
              <p className="text-sm text-gray-600">ウォーターマーク・Glaze・ステガノ処理を自動で施します</p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-start space-x-4">
            <div className="w-10 h-10 bg-[#00a1e9] text-white rounded-full flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <p className="font-bold">展示・販売スタート</p>
              <p className="text-sm text-gray-600">ギャラリーに作品が掲載され、販売も開始されます</p>
            </div>
          </div>
        </div>
      </section>

      {/* NFT販売について */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-3">NFT販売をご希望の方へ</h2>
        <p className="mb-4">
          me-ishでは、NFT販売を希望される作品について、当ギャラリー側で責任を持ってNFT化（mint）いたします。
        </p>
        <ul className="list-disc ml-6 space-y-2 mb-4">
          <li>NFTはme-ish独自のスマートコントラクトで発行（Thirdweb/Paper連携）</li>
          <li>購入者のウォレットアドレスへ直接転送され、所有がブロックチェーン上に記録</li>
          <li>作家のウォレットは不要（販売報酬は日本円でお支払い）</li>
          <li>作品には必ず保護処理（Glaze・ステガノ・署名またはWM）を施してからmint</li>
        </ul>
        <p>
          NFTを通じてあなたの作品が「唯一無二の存在」として正式に証明され、ブロックチェーン上で記録されます。
          me-ishでは、初めてNFTを扱う方でも安心して出展いただけるようサポート体制を整えています。
        </p>
      </section>

      {/* 作品の取り扱いと保護 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-3">作品の取り扱いと保護について</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>出展作品にはウォーターマーク・Glaze・ステガノグラフィーを施します</li>
          <li>作家自身による署名（サイン）画像を推奨。署名がある場合はWMを省略可能</li>
          <li>AI生成画像は禁止。人間による創作と確認できる作品のみ受付</li>
        </ul>
      </section>

      {/* 出展料 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-3">出展料について</h2>
        <p>
          現在、初回展示は無料キャンペーンを実施中（1ヶ月間）。
          継続展示や表示保証付きプランをご希望の場合は、有料プランをご案内しています。
        </p>
        <p className="mt-2">
          詳しくは <a href="/pricing" className="text-[#00a1e9] underline font-bold hover:opacity-80">料金プランページ</a> をご確認ください。
        </p>
      </section>

      {/* 応募誘導 */}
      <div className="text-center mt-16">
        <a
          href="/entry"
          className="inline-block bg-[#00a1e9] text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-[#008ec4] transition"
        >
          応募フォームへ進む
        </a>
      </div>
    </main>
  );
}
