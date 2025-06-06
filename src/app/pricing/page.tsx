'use client';

export default function PricingPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#333] leading-relaxed">
      <h1 className="text-4xl font-bold text-[#00a1e9] mb-10 text-center">
        料金プラン
      </h1>

      {/* 概要 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">me-ishは、基本無料でご利用いただけます</h2>
        <p className="mb-4">
          me-ishは、出展のハードルを下げるために「基本無料」でご利用いただける仕組みを採用しています。  
        </p>
        <p>
          もっと確実に作品を見てもらいたい方や、優先的に表示されたい方のために、
          表示保証付きの有料プランもご用意しています（任意）。
        </p>
      </section>

      {/* プラン表 */}
      <section className="mb-12">
        <h2 className="text-xl font-bold mb-4">表示保証付きプラン（オプション）</h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300 text-sm text-left">
            <thead className="bg-[#f6f8fb]">
              <tr>
                <th className="p-3 border">プラン名</th>
                <th className="p-3 border">価格（税込）</th>
                <th className="p-3 border">保証表示回数</th>
                <th className="p-3 border">保証内容</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 border font-bold">Mini</td>
                <td className="p-3 border">¥400</td>
                <td className="p-3 border">1回</td>
                <td className="p-3 border">1ヶ月内に1回、必ず表示されます</td>
              </tr>
              <tr>
                <td className="p-3 border font-bold">Light</td>
                <td className="p-3 border">¥1,000</td>
                <td className="p-3 border">3回</td>
                <td className="p-3 border">週1回ペースで優先表示</td>
              </tr>
              <tr>
                <td className="p-3 border font-bold">Standard</td>
                <td className="p-3 border">¥2,000</td>
                <td className="p-3 border">7回</td>
                <td className="p-3 border">週2回＋αの頻度で優先表示</td>
              </tr>
              <tr>
                <td className="p-3 border font-bold">Premium</td>
                <td className="p-3 border">¥4,000</td>
                <td className="p-3 border">15回</td>
                <td className="p-3 border">2日に1回ペースで優先表示</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 補足事項 */}
      <section className="mb-16">
        <h2 className="text-xl font-bold mb-3">補足事項</h2>
        <ul className="list-disc ml-6 space-y-2 text-sm">
          <li>
            各プランは1ヶ月間の展示枠に適用されます。
            表示保証回数とは、<strong>その月の間に、指定回数分必ずギャラリー上に表示される</strong>ことを意味します。
          </li>
          <li>
            保証回数を消化した後も、作品は一般ローテーション枠で掲載され続けます（非保証枠）。
          </li>
          <li>料金は1作品ごとに適用されます（複数出展時は作品数分必要です）</li>
          <li>作品が売れた場合のみ、販売手数料（5%）が発生します</li>
        </ul>
      </section>

      {/* CTA */}
      <div className="text-center mt-10">
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
