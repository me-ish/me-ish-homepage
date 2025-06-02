// app/about/page.tsx

'use client';

export default function AboutPage() {
  return (
    <main className="px-6 py-16 max-w-3xl mx-auto text-[#333] leading-relaxed">
      <h1 className="text-4xl font-lilita text-[#00a1e9] mb-10 text-center">me-ishとは</h1>

      {/* セクション1：コンセプト */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">アートを、もっと近くに。</h2>
        <p>
          me-ish（ミーイッシュ）は、誰でも参加できるオンラインの3Dアートギャラリーです。プロ・アマ問わず、作品を展示・販売できる開かれた場として、NFT販売や円での通常販売にも対応しています。
        </p>
      </section>

      {/* セクション2：me-ishの特長 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">me-ishの特長</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>3D空間での臨場感ある展示体験</li>
          <li>ウォーターマーク＋Glaze＋ステガノによるAI学習防止</li>
          <li>アカウント不要で応募可能な出展フロー</li>
          <li>NFTと通常販売どちらにも対応</li>
          <li>展示保証スロットで確実に作品を届けられる仕組み</li>
        </ul>
      </section>

      {/* セクション3：対象となる人 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">こんな方におすすめ</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>まだ知られていないけど、真剣に作品を届けたいアーティスト</li>
          <li>NFTの出品・販売に初めて挑戦してみたい方</li>
          <li>気軽にアートを楽しみたいアートファン</li>
          <li>新しい才能を発掘したいアートコレクター</li>
        </ul>
      </section>

      {/* セクション4：運営背景 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-3">なぜme-ishを作ったのか</h2>
        <p>
          駆け出しのイラストレーターを支援する中で、才能があるのに日の目を見ない作品が多いことに気づきました。もっと多くのアーティストが作品を発表できる場所を――その思いから、me-ishは生まれました。
        </p>
        <p className="mt-2">
          「展示のハードルを下げつつ、作品はしっかり守る」という両立を目指し、気軽に応募できて、NFTも扱える、あたらしい形のギャラリーです。
        </p>
      </section>

      {/* CTA：ギャラリー誘導 */}
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
