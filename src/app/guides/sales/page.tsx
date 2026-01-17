// src/app/guides/sales/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Tags, GalleryHorizontalEnd, RefreshCcw, Info, Sparkles } from 'lucide-react';
import CloseTabFooter from './_components/CloseTabFooter';

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

const LAST_UPDATED = '2026-01-17';

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

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="mx-1 inline-flex items-center rounded-md bg-gray-100 px-1.5 py-0.5 text-sm font-semibold">
    {children}
  </span>
);

const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-sm text-gray-600">{children}</p>
);

export default function SalesGuidelinePage() {
  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-8 font-zen">
      {/* ヘッダー */}
      <header className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">me-ish 販売ガイドライン</h1>
        </div>

        <p className="text-sm text-gray-500 mt-2">最終更新：{LAST_UPDATED}</p>

        <p className="mt-3 text-gray-700 leading-relaxed">
          このページは、出展するアーティストが迷わずに「販売する／しない」を選べるよう、
          必要なポイントだけを短くまとめたガイドです。
          詳細条件は <Link href="/footer/terms" className="underline">利用規約</Link> と
          <Link href="/footer/faq" className="underline ml-1">FAQ</Link> を優先します。
        </p>
      </header>

      {/* 1. 出展前に確認すること */}
      <Section icon={<ShieldCheck className="w-5 h-5" />} title="1. 出展前に確認すること">
        <ul className="list-disc list-inside space-y-2 text-gray-800 leading-relaxed">
          <li>
            出展できるのは<strong>オリジナル作品</strong>のみです（第三者の権利を侵害しないこと）。
          </li>
          <li>
            <strong>完全にAIのみで生成した作品（人の創作が含まれないもの）は出展不可</strong>です。
          </li>
          <li>
            著作権・商標権・肖像権などを侵害する内容、公序良俗に反する内容は出展できません。
          </li>
          <li>
            出展は無料ですが、販売した場合は<Pill>手数料 10%</Pill>が売上から差し引かれます。
          </li>
          <li>
            決済は<Pill>Stripe（クレジットカード／円）</Pill>のみです。
          </li>
        </ul>

        <Note>
          ※ AIの使用は「禁止」ではなく、<strong>申告が必須</strong>です（後述「AIの使用申告」参照）。
          ただし<strong>完全生成のみは不可</strong>という線引きは明確に運用します。
        </Note>
      </Section>

      {/* 2. 価格・販売形式の決め方 */}
      <Section icon={<Tags className="w-5 h-5" />} title="2. 価格・販売形式の決め方">
        <ul className="list-disc list-inside space-y-2 text-gray-800 leading-relaxed">
          <li>
            応募時に<strong>「販売する／販売しない」</strong>を選べます（販売しない場合は「非売品」として展示）。
          </li>
          <li>
            販売する場合は、価格（円）を設定します（表示は税込・小数点なし）。
          </li>
          <li>
            販売点数（エディション数）を設定できます（例：1点のみ／複数点／無制限）。
          </li>
          <li>
            <strong>サインがある場合は推奨</strong>です（サインがない場合はウォーターマークを付与します）。
          </li>
        </ul>

        <Note>
          ※ 価格は「制作コスト＋希少性＋今後の継続性」を軸に、無理のない範囲から始めるのを推奨します。
        </Note>
      </Section>

      {/* 3. AIの使用申告（重要） */}
      <Section icon={<Sparkles className="w-5 h-5" />} title="3. AIの使用申告（重要）">
        <div className="space-y-4 text-gray-800 leading-relaxed">
          <p>
            me-ishでは、制作におけるAIの利用を<strong>一律に排除</strong>するのではなく、
            <strong>「どこまでAIを使ったか」</strong>を申告してもらう運用を採用します。
            ただし、次は明確に不可です。
          </p>

          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-4">
            <p className="font-semibold text-rose-700">完全生成（AIのみ）作品は出展不可</p>
            <p className="text-sm text-rose-700/90 mt-1">
              人の創作工程（描画・制作・編集・構成の主体）が含まれない「生成結果そのまま」は受け付けません。
            </p>
          </div>

          <div>
            <p className="font-semibold mb-2">申告区分（フォームの選択と対応）</p>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>AI不使用</strong>：AIを制作工程に使っていない
              </li>
              <li>
                <strong>AI補助</strong>：ラフ出し／アイデア出し／参考生成／色味検討など、最終成果物の主体は人の制作
              </li>
              <li>
                <strong>AI生成＋人の制作</strong>：生成物を素材・下地として使い、<strong>人が加筆・再構成・制作の主体</strong>が明確なもの（使用範囲の申告が必須）
              </li>
            </ul>
          </div>

          <div className="text-sm text-gray-700">
            <p className="font-semibold mb-1">表示について</p>
            <p>
              申告内容は、購入者や鑑賞者が誤解しないよう、me-ish側の表示（バッジ等）に反映する場合があります
              （仕様は運用しながら整備します）。
            </p>
          </div>
        </div>
      </Section>

      {/* 4. 展示と販売の流れ */}
      <Section icon={<GalleryHorizontalEnd className="w-5 h-5" />} title="4. 展示と販売の流れ">
        <ol className="list-decimal list-inside space-y-2 text-gray-800 leading-relaxed">
          <li>応募フォームから出展申請 → 運営による審査</li>
          <li>
            承認後、作品画像に保護処理（<strong>サイン推奨／サインがない場合はウォーターマーク＋AI認識阻害処理</strong>）を実施
          </li>
          <li>ギャラリーで展示開始（販売する場合は購入導線が表示されます）</li>
          <li>
            購入があるたびに販売点数が減り、<strong>残りが0になった時点で自動的に SOLD</strong> に切り替え（決済は Stripe）
          </li>
          <li>売上は翌月にまとめて振込します（登録口座へ月次振込）</li>
        </ol>
      </Section>

      {/* 5. 再販・再出展 */}
      <Section icon={<RefreshCcw className="w-5 h-5" />} title="5. 再販・再出展">
        <div className="space-y-4 text-gray-800 leading-relaxed">
          <div>
            <h3 className="font-semibold mb-1">White ギャラリー</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>承認された作品は<strong>基本的に常設展示</strong>です。（β用ギャラリーのため10作品限定）</li>
              <li>SOLD（完売）になっても表示は継続します。</li>
              <li>同一作品を再度出展する必要はありません。</li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-1">Float ギャラリー</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>展示期間は<strong>原則 1 か月</strong>です（開始日に基づき終了日を自動設定）。</li>
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
                希少性維持のため、再販は基本的におすすめしません（禁止ではありません）。
              </li>
              <li>
                <strong>無制限販売を選んだ場合：</strong>必要に応じて販売を継続・再出展できます。
              </li>
              <li>
                販売点数を増やす等の「再販」を行う場合は、<strong>新規出展として申請</strong>してください。
              </li>
              <li>同一作品の再展示や再販には上限は設けませんが、展示枠や運営状況により調整する場合があります。</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* 6. 注意点 */}
      <Section icon={<Info className="w-5 h-5" />} title="6. 注意点">
        <ul className="list-disc list-inside space-y-2 text-gray-800 leading-relaxed">
          <li>
            展示期間中は完売後も作品は削除せず、
            <span className="ml-1 rounded-md bg-red-50 px-1.5 py-0.5 text-sm font-bold text-red-600">SOLD</span>
            ラベルを付けて展示を続けます。
          </li>
          <li>審査は「品質の優劣」ではなく、権利・安全・運用の観点で確認します。</li>
          <li>不適切な作品は審査で却下される場合があります。</li>
          <li>運用上、表示用画像の軽微なリサイズ・圧縮を行う場合があります。</li>
        </ul>
      </Section>

{/* フッターCTA */}
<CloseTabFooter />


    </main>
  );
}
