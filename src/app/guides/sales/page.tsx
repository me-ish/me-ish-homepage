// src/app/guides/sales/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Tags, GalleryHorizontalEnd, RefreshCcw, Info } from 'lucide-react';

export const metadata: Metadata = {
  title: '販売ガイドライン（アーティスト向け） | me-ish',
  description: 'me-ish で作品を出展・販売するアーティスト向けの公式ガイドラインです。',
  openGraph: {
    title: '販売ガイドライン（アーティスト向け） | me-ish',
    description: 'me-ish で作品を出展・販売するアーティスト向けの公式ガイドラインです。',
    url: 'https://www.me-ish.art/guides/sales',
    type: 'article',
  },
};

const Section = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-8">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-6 w-1.5 rounded-full bg-[#00a1e9]" />
      <div className="flex items-center gap-2">
        <span className="text-[#00a1e9]">{icon}</span>
        <h2 className="text-2xl font-bold">{title}</h2>
      </div>
    </div>
    <div className="rounded-xl border border-gray-200/70 bg-white/80 p-5 shadow-sm">
      {children}
    </div>
  </section>
);

export default function SalesGuidelinePage() {
  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-8 font-zen">
      {/* ヘッダー */}
      <header className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">me-ish 販売ガイドライン</h1>
        </div>
        <p className="text-sm text-gray-500 mt-2">最終更新：2025-09-21</p>
        <p className="mt-3 text-gray-700">
          出展するアーティストが迷わずに販売できるよう、必要なポイントだけをまとめています。
        </p>
      </header>

      {/* 1. 出展前に確認すること */}
      <Section icon={<ShieldCheck className="w-5 h-5" />} title="1. 出展前に確認すること">
        <ul className="list-disc list-inside space-y-2 text-gray-800">
          <li>
            作品は<strong>オリジナル作品のみ</strong>出展可能です。
          </li>
          <li>
            <strong>AI生成作品は禁止</strong>です
            <span className="text-gray-500 text-sm">（将来的に見直す可能性あり）</span>。
          </li>
          <li>著作権・肖像権を侵害する作品は出展できません。</li>
          <li>
            出展は無料ですが、販売時には
            <span className="mx-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-sm font-semibold">
              手数料 10%
            </span>
            が差し引かれます。
          </li>
        </ul>
      </Section>

      {/* 2. 価格・販売形式の決め方 */}
      <Section icon={<Tags className="w-5 h-5" />} title="2. 価格・販売形式の決め方">
        <ul className="list-disc list-inside space-y-2 text-gray-800">
          <li>
            販売方法は「通常販売」と「NFT販売」の2種類があります。
            <Link
              href="/guides/nft"
              className="ml-2 inline-flex items-center rounded-full border border-[#00a1e9]/40 bg-[#00a1e9]/10 px-2 py-0.5 text-xs font-semibold text-[#00a1e9] hover:bg-[#00a1e9]/15 hover:border-[#00a1e9]/60 transition"
            >
              NFT販売ってなに？
            </Link>
          </li>
          <li>販売点数（エディション数）を自由に設定できます。</li>
          <li>1点のみ販売することも、複数点を販売することも可能です。</li>
          <li>販売しない場合は「非売品」として展示できます。</li>
        </ul>
      </Section>

      {/* 3. 展示と販売の流れ */}
      <Section icon={<GalleryHorizontalEnd className="w-5 h-5" />} title="3. 展示と販売の流れ">
        <ol className="list-decimal list-inside space-y-2 text-gray-800">
          <li>応募フォームから出展 → 運営による審査</li>
          <li>
            承認後、作品画像に保護処理（
            <strong>サイン推奨／サインがない場合はウォーターマーク＋AI認識阻害処理</strong>
            ）を実施
          </li>
          <li>
            ギャラリーで展示開始（販売中／
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-sm font-medium">販売点数すべて販売</span>
            で
            <span className="ml-1 rounded-md bg-red-50 px-1.5 py-0.5 text-sm font-bold text-red-600">SOLD</span>
            表記）
          </li>
          <li>
            購入があるたびに販売点数が減り、
            <strong>残りが0になった時点で自動的に SOLD</strong> に切り替え（
            <strong>通常販売・NFTとも決済は Stripe</strong>）
          </li>
          <li>売上は翌月にまとめて振込します</li>
        </ol>
      </Section>

      {/* 4. 再販・再出展 */}
      <Section icon={<RefreshCcw className="w-5 h-5" />} title="4. 再販・再出展">
        <div className="space-y-4 text-gray-800">
          <div>
            <h3 className="font-semibold mb-1">White ギャラリー</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                承認された作品は<strong>基本的に常設展示</strong>です。
              </li>
              <li>SOLD（完売）になっても表示は継続します。</li>
              <li>同一作品を再度出展する必要はありません。</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Float ギャラリー</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                展示期間は<strong>原則 1 か月</strong>です（開始日に基づき終了日を自動設定）。
              </li>
              <li>期間終了後はいったん展示終了となります。</li>
              <li>
                <strong>再展示を希望する場合</strong>は、応募フォームから再出展リクエストを行ってください（空き枠・ローテーション状況により調整）。
              </li>
              <li>期間中に完売しても、終了日までは SOLD ラベル付きで表示します。</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1">再販の考え方（販売点数・無制限）</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>販売点数を限定（エディション）にした場合：</strong>
                希少性維持のため、
                <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-sm font-medium text-rose-700 border border-rose-200">
                  再販は基本的におすすめしません
                </span>
                （禁止ではありません）。
              </li>
              <li>
                <strong>無制限販売を選んだ場合：</strong>必要に応じて販売を継続・再出展できます。
              </li>
              <li>
                販売点数を増やす等の「再販」を行う場合は、
                <strong>新規出展として申請</strong>してください。
              </li>
              <li>同一作品の再展示や再販には上限は設けませんが、展示枠や運営状況により調整する場合があります。</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* 5. 注意点 */}
      <Section icon={<Info className="w-5 h-5" />} title="5. 注意点">
        <ul className="list-disc list-inside space-y-2 text-gray-800">
          <li>展示期間中は完売後も作品は削除せず、 <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-sm font-bold text-red-600">SOLD</span> ラベルを付けて展示を続けます。</li>
          <li>不適切な作品は審査で却下される場合があります。</li>
        </ul>
      </Section>

      {/* フッターCTA */}
      <footer className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link
          href="/entry"
          className="inline-flex items-center justify-center rounded-full border border-[#00a1e9]/40 bg-white px-4 py-2 text-[#00a1e9] hover:bg-[#00a1e9]/5 hover:border-[#00a1e9]/60 transition"
        >
          応募フォームへ戻る
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 hover:bg-gray-50 transition"
        >
          トップページ
        </Link>
      </footer>
    </main>
  );
}
