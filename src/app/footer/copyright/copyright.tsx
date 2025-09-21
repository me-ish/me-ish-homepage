// src/app/footer/copyright/page.tsx  ← あなたのパスに合わせています
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '著作権・AI学習防止ポリシー | me-ish',
  description:
    'アーティストの作品保護とAI学習防止に関するme-ishのポリシーです。著作権の帰属、利用範囲、AI学習防止措置、購入者の権利、無断利用の通報など。',
};

export default function CopyrightPolicyPage() {
  const toc: Array<[string, string]> = [
    ['目的・定義', 'sec-0'],
    ['著作権の帰属', 'sec-1'],
    ['利用者の許される範囲', 'sec-2'],
    ['AI学習防止措置', 'sec-3'],
    ['生成AI作品の取扱い', 'sec-4'],
    ['購入者の権利（通常／NFT）', 'sec-5'],
    ['当サービスによる利用許諾', 'sec-6'],
    ['無断利用の通報・対応', 'sec-7'],
    ['クローリング・回避行為の禁止', 'sec-8'],
    ['改定・お問い合わせ', 'sec-9'],
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* ヘッダ */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">著作権・AI学習防止ポリシー</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          me-ish（以下「当サービス」）は、アーティストの創作と権利を尊重し、作品の不正利用およびAI学習への無断利用を防ぐため、本ポリシーを定めます。
          本ポリシーは、<Link href="/footer/terms" className="underline underline-offset-2">利用規約</Link>、
          <Link href="/footer/privacy" className="underline underline-offset-2">プライバシーポリシー</Link> と併せて適用されます。
        </p>
      </header>

      {/* 目次 */}
      <aside
        className="mb-8 rounded-2xl border bg-gray-50 p-4 text-sm md:float-right md:ml-8 md:w-72"
        aria-labelledby="toc-title"
      >
        <div id="toc-title" className="font-semibold">目次</div>
        <nav className="mt-2 grid gap-1" aria-label="ページ内目次">
          {toc.map(([label, id]) => (
            <a key={id} href={`#${id}`} className="underline-offset-2 hover:underline">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* 本文（以下は内容そのまま） */}
      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2 id="sec-0" className="scroll-mt-28"><strong>第0条（目的・定義）</strong></h2>
        <p>
          本ポリシーは、当サービス上で表示・販売される作品（画像・映像・音声・テキスト・3D等。以下「作品」）の権利保護と
          無断学習の防止を目的とします。用語の定義は
          <Link href="/footer/terms#sec-4" className="underline underline-offset-2">利用規約 第4条</Link>
          を準用します。
        </p>

        <h2 id="sec-1" className="scroll-mt-28"><strong>第1条（著作権の帰属）</strong></h2>
        <p>作品の著作権その他の知的財産権は、原則としてアーティストに帰属します。当サービスが著作権の譲渡を要求することはありません。</p>
        <p>表示・保護のため、<strong>作者サイン（署名）の付与を推奨</strong>し、サインが無い場合は当サービス側で「created by 作家名」等の<strong>ウォーターマーク（WM）</strong>を付与する場合があります。</p>

        <h2 id="sec-2" className="scroll-mt-28"><strong>第2条（利用者の許される範囲）</strong></h2>
        <p>利用者（閲覧者・購入者）は、権利者の明示の許諾なく次の行為を行ってはなりません。</p>
        <ul>
          <li>商用利用、再配布、転載、二次利用、改変・加工、公衆送信、二次創作の公開</li>
          <li>スクレイピング・自動取得・データセット化・モデル評価・類似モデル生成</li>
          <li><strong>AI学習への提供（アップロード、学習素材化、微調整等）</strong></li>
        </ul>
        <p className="text-sm text-gray-600">※法令上の適用ある例外（私的使用のための複製など）が認められる範囲を除きます。詳細は<Link href="/footer/terms#sec-4" className="underline underline-offset-2">利用規約 第4条</Link> を参照してください。</p>

        <h2 id="sec-3" className="scroll-mt-28"><strong>第3条（AI学習防止措置）</strong></h2>
        <p>当サービスは、作品保護のため、状況に応じて以下の<strong>AI認識阻害処理</strong>を実施します（恒久的効果は保証しません）。</p>
        <ul>
          <li>ウォーターマーク（視覚的透かし）の付与</li>
          <li>ステガノグラフィー（不可視情報の埋め込み）</li>
          <li>微細ノイズ等の付加による学習阻害処理（例：Glaze 等）</li>
        </ul>
        <p className="text-sm text-gray-600">※端末性能や表示品質に配慮し、アーティストの意向と運用ポリシーに基づき付与します。<br />※AI学習を完全に防止できることを保証するものではありません。</p>

        <h2 id="sec-4" className="scroll-mt-28"><strong>第4条（生成AI作品の取扱い）</strong></h2>
        <p>学習元の適法性や権利帰属の不明確さから、<strong>画像生成AI（例：Stable Diffusion、Midjourney、DALL·E等）により生成された作品の出展を禁止</strong>します。人手による創作を含まない生成物のみの出展はできません。</p>

        <h2 id="sec-5" className="scroll-mt-28"><strong>第5条（購入者の権利：通常販売／NFT）</strong></h2>
        <ul>
          <li><strong>通常販売（デジタル納品）</strong>：購入は、私的利用の範囲での閲覧・保存権を付与するもので、著作権や二次利用権は移転しません（<Link href="/footer/terms#sec-4" className="underline">利用規約 第4条</Link>参照）。</li>
          <li><strong>NFT販売</strong>：NFTトークンの所有権は購入者に移転しますが、<strong>知的財産権は移転しません</strong>（<Link href="/footer/terms#sec-8" className="underline">利用規約 第8条</Link>参照）。</li>
        </ul>

        <h2 id="sec-6" className="scroll-mt-28"><strong>第6条（当サービスによる利用許諾）</strong></h2>
        <p>アーティストは、当サービスでの展示、告知・広報、作品紹介（サイト内表示、サムネイル生成、SNS投稿、告知素材への掲載等）の範囲で、当サービスが<strong>無償・非独占的に作品を利用すること</strong>を許諾します。WMやAI認識阻害処理の付与・再加工はこの範囲に含みます。</p>

        <h2 id="sec-7" className="scroll-mt-28"><strong>第7条（無断利用の通報・対応）</strong></h2>
        <p>無断転載やAI学習への流用等を確認した場合、当サービスは把握可能な範囲で削除申請・連絡・抗議等の対応を行います。アーティストからの通報には個別事情を踏まえて支援し、悪質な場合は法的措置も検討します。</p>
        <p>通報は <Link href="/contact" className="underline underline-offset-2">お問い合わせフォーム</Link> または <span>info [at] me-ish.art</span> まで（送信時は「[at]」を「@」に置換）。</p>

        <h2 id="sec-8" className="scroll-mt-28"><strong>第8条（クローリング・回避行為の禁止）</strong></h2>
        <ul>
          <li>ロボット・スクレイパー等による自動取得、過度なアクセス、脆弱性の探索</li>
          <li><strong>WM・ステガノグラフィー・ノイズ除去等の回避または除去を目的とする行為</strong></li>
          <li>当サービスが設ける技術的保護手段の無効化</li>
        </ul>
        <p className="text-sm text-gray-600">これらの行為は <Link href="/footer/terms#sec-5" className="underline">利用規約 第5条（禁止行為）</Link> にも該当します。重大・反復の場合、アクセス遮断・法的措置等を行うことがあります。</p>

        <h2 id="sec-9" className="scroll-mt-28"><strong>第9条（改定・お問い合わせ）</strong></h2>
        <p>本ポリシーは、必要に応じて予告なく改定されることがあります。改定後は当サイト掲載時から効力を生じます。</p>
        <p>本ポリシーに関するお問い合わせ・通報は、<Link href="/contact" className="underline underline-offset-2">お問い合わせフォーム</Link> または <span>info [at] me-ish.art</span> へお願いします（送信時は「[at]」を「@」に置換）。</p>
        <p><time dateTime="2025-08-18">制定日：2025年8月18日</time><br /><time dateTime="2025-09-21">改定日：2025年9月21日</time></p>
      </article>
    </main>
  );
}
