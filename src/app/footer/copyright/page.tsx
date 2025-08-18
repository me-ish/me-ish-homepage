'use client';

import Link from 'next/link';

export default function CopyrightPolicyPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      {/* ヘッダ */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">著作権・AI学習防止ポリシー</h1>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          me-ish（以下「当サービス」）は、アーティストの創作と権利を尊重し、作品の不正利用およびAI学習への無断利用を防ぐため、以下の方針を定めます。
        </p>
      </header>

      {/* 目次 */}
      <aside className="mb-8 rounded-2xl border bg-gray-50 p-4 text-sm md:float-right md:ml-8 md:w-72">
        <div className="font-semibold">目次</div>
        <nav className="mt-2 grid gap-1">
          {[
            ['著作権の帰属', 'sec-1'],
            ['利用者の許される範囲', 'sec-2'],
            ['AI学習防止措置', 'sec-3'],
            ['生成AI作品の取扱い', 'sec-4'],
            ['購入者の権利（通常/NFT）', 'sec-5'],
            ['当サービスによる利用許諾', 'sec-6'],
            ['無断利用の通報・対応', 'sec-7'],
            ['クローリング等の禁止', 'sec-8'],
            ['改定・お問い合わせ', 'sec-9'],
          ].map(([label, id]) => (
            <a key={id} href={`#${id}`} className="underline-offset-2 hover:underline">
              {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* 本文 */}
      <article className="prose prose-neutral max-w-none leading-relaxed space-y-6">
        <h2 id="sec-1"><strong>第1条（著作権の帰属）</strong></h2>
        <p>
          当サービスに出展される全ての作品（画像・映像・音声・テキスト・3Dデータ等）の著作権等は、原則として出展アーティストに帰属します。
          当サービスが著作権の譲渡を要求することはありません。
        </p>
        <p>
          当サービスは作品の保護方針として、<strong>作家によるサイン（署名）を推奨</strong>し、サインが無い場合は当サービス側で
          「created by 作家名」等のウォーターマーク（以下「WM」）を付与する場合があります。
        </p>

        <h2 id="sec-2"><strong>第2条（利用者の許される範囲）</strong></h2>
        <p>利用者（閲覧者・購入者）は、権利者の明示の許諾なく次の行為を行ってはなりません。</p>
        <ul>
          <li>商用利用、再配布、転載、二次利用、改変・加工、公衆送信</li>
          <li>スクレイピング・自動取得・データセット化・モデル評価・類似モデル生成</li>
          <li>AI学習への提供（アップロード、学習素材化、モデル微調整を含む）</li>
        </ul>

        <h2 id="sec-3"><strong>第3条（AI学習防止措置）</strong></h2>
        <p>
          当サービスは、作品保護のため、以下の<strong>AI認識阻害処理</strong>を適宜実施します（効果を恒久的に保証するものではありません）。
        </p>
        <ul>
          <li>ウォーターマーク（視覚的透かし）の付与</li>
          <li>ステガノグラフィー（不可視情報の埋め込み）</li>
          <li>微細ノイズ等の付加による学習阻害処理（例：Glaze等の手法）</li>
        </ul>
        <p className="text-sm text-gray-600">
          ※表示品質や端末性能に配慮しつつ、アーティストの意向と運用ポリシーに基づき付与します。<br />
          ※AI学習の完全な防止を保証するものではありません。
        </p>

        <h2 id="sec-4"><strong>第4条（生成AI作品の取扱い）</strong></h2>
        <p>
          学習元の適法性や著作権帰属が不明瞭である懸念から、<strong>画像生成AI（例：Stable Diffusion、Midjourney、DALL·E等）により生成された作品の出展を禁止</strong>します。
        </p>

        <h2 id="sec-5"><strong>第5条（購入者の権利：通常販売／NFT）</strong></h2>
        <ul>
          <li>
            <strong>通常販売（デジタル納品）</strong>：
            作品データの購入は、私的利用の範囲での閲覧・保存権を付与するものであり、著作権や二次利用権を移転するものではありません（明記がある場合を除く）。
          </li>
          <li>
            <strong>NFT販売</strong>：
            NFTトークンの所有権は購入者に移転しますが、<strong>知的財産権は移転しません</strong>（コントラクトまたは作品ページに別段の定めがある場合を除く）。
          </li>
        </ul>

        <h2 id="sec-6"><strong>第6条（当サービスによる利用許諾）</strong></h2>
        <p>
          アーティストは、当サービスの運営・広報・作品紹介（サイト内展示、サムネイル生成、SNS投稿、告知素材への掲載等）の範囲で、
          当サービスが<strong>無償・非独占的に作品を利用すること</strong>を許諾します。WMやAI認識阻害処理の付与・再加工はこの範囲に含みます。
        </p>

        <h2 id="sec-7"><strong>第7条（無断利用の通報・対応）</strong></h2>
        <p>
          作品の無断転載・AI学習への流用等を確認した場合、当サービスは把握可能な範囲で削除申請・連絡・抗議等の対応を行います。
          アーティストからの通報には個別事情を踏まえて支援し、悪質な場合は法的措置も検討します。
        </p>
        <p>
          通報は
          <Link href="/contact/form" className="underline underline-offset-2">お問い合わせフォーム</Link>
          または <span>info [at] me-ish.art</span> までお寄せください（送信時は「[at]」を「@」に置換）。
        </p>

        <h2 id="sec-8"><strong>第8条（クローリング・回避行為の禁止）</strong></h2>
        <ul>
          <li>ロボット・スクレイパー等による自動取得、過度なアクセス、脆弱性の探索</li>
          <li>WM・ステガノグラフィー・ノイズ除去等の<strong>回避または除去を目的とする行為</strong></li>
          <li>当サービスが設ける技術的保護手段の無効化</li>
        </ul>

        <h2 id="sec-9"><strong>第9条（改定・お問い合わせ）</strong></h2>
        <p>本ポリシーは、必要に応じて予告なく改定されることがあります。改定後は当サイト掲載時から効力を生じます。</p>
        <p>
          本ポリシーに関するお問い合わせ・通報は、
          <Link href="/contact/form" className="underline underline-offset-2">お問い合わせフォーム</Link>
          または <span>info [at] me-ish.art</span> へお願いします（送信時は「[at]」を「@」に置換）。
        </p>
        <p>制定日：2025年8月18日</p>
      </article>
    </main>
  );
}
