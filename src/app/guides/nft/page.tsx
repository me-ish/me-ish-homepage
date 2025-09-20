import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Info,
  Layers,
  Lock,
  Brush,
  BadgeCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'NFTとは | me-ish',
  description:
    'NFT（Non-Fungible Token）の基本、所有権と著作権の違い、me-ishでのNFT化（mint）の考え方をわかりやすく解説します。',
  openGraph: {
    title: 'NFTとは | me-ish',
    description:
      'NFT（Non-Fungible Token）の基本、所有権と著作権の違い、me-ishでのNFT化（mint）の考え方をわかりやすく解説します。',
    url: 'https://www.me-ish.art/guides/nft',
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
    <div className="mb-3 flex items-center gap-2">
      <span className="h-6 w-1.5 rounded-full bg-[#00a1e9]" />
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

/** シンプル図解（SVG） */
function NftSimpleDiagram() {
  return (
    <figure className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <figcaption className="mb-3 text-sm text-gray-600">
        図：作品 → me-ishがNFT化（mint） → ブロックチェーン → 購入者のウォレット（トークン所有）
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 920 240"
          className="h-[220px] min-w-[720px] w-full"
          role="img"
          aria-labelledby="nft-diagram-title nft-diagram-desc"
        >
          <title id="nft-diagram-title">NFTの流れ（所有権と著作権の整理）</title>
          <desc id="nft-diagram-desc">
            1. アーティストの作品がme-ishに提出される。
            2. me-ishが作品情報を元にNFTを発行（mint）する。
            3. NFTはブロックチェーン上に記録される。
            4. 購入者のウォレットにNFTトークンの所有権が移る。
            著作権は作者に残る。
          </desc>

          {/* Box helpers */}
          const box = (x:number,y:number,w:number,h:number,rx=12)=''
          {/* Boxes */}
          <rect x="20"  y="50" width="200" height="110" rx="12" fill="#F8FAFF" stroke="#CFE8F9" />
          <rect x="250" y="50" width="200" height="110" rx="12" fill="#F8FFFB" stroke="#BFEAD7" />
          <rect x="480" y="50" width="200" height="110" rx="12" fill="#FFFDF7" stroke="#F1E0B5" />
          <rect x="710" y="50" width="200" height="110" rx="12" fill="#F9F9FF" stroke="#D6D6F7" />

          {/* Labels */}
          <g fontFamily="ui-sans-serif,system-ui" fontSize="14" fill="#111827">
            <text x="120" y="85" textAnchor="middle" fontWeight="700">アーティスト作品</text>
            <text x="120" y="108" textAnchor="middle">画像・タイトル・説明など</text>

            <text x="350" y="85" textAnchor="middle" fontWeight="700">me-ish（運営）</text>
            <text x="350" y="108" textAnchor="middle">作品情報をもとに</text>
            <text x="350" y="128" textAnchor="middle" fill="#00a1e9" fontWeight="700">NFT化（mint）を実施</text>

            <text x="580" y="85" textAnchor="middle" fontWeight="700">ブロックチェーン</text>
            <text x="580" y="108" textAnchor="middle">NFTメタデータ</text>
            <text x="580" y="128" textAnchor="middle">所有履歴が記録</text>

            <text x="810" y="85" textAnchor="middle" fontWeight="700">購入者のウォレット</text>
            <text x="810" y="108" textAnchor="middle">NFTトークン</text>
            <text x="810" y="128" textAnchor="middle">＝ 所有権の証明</text>
          </g>

          {/* Arrows */}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
            </marker>
          </defs>
          <line x1="220" y1="105" x2="250" y2="105" stroke="#9CA3AF" strokeWidth="2.5" markerEnd="url(#arrow)" />
          <line x1="450" y1="105" x2="480" y2="105" stroke="#9CA3AF" strokeWidth="2.5" markerEnd="url(#arrow)" />
          <line x1="680" y1="105" x2="710" y2="105" stroke="#9CA3AF" strokeWidth="2.5" markerEnd="url(#arrow)" />

          {/* Copyright note */}
          <g transform="translate(20,180)">
            <rect width="890" height="42" rx="10" fill="#F3F4F6" />
            <text x="16" y="27" fontFamily="ui-sans-serif,system-ui" fontSize="13" fill="#374151">
              ※ NFTの「所有権」はトークンの所有を意味し、作品そのものの
              <tspan fontWeight="700">著作権は作者に残ります</tspan>。
              商用利用や二次創作の可否は各ガイドラインや個別規約に従います。
            </text>
          </g>
        </svg>
      </div>
    </figure>
  );
}

export default function NftGuidePage() {
  return (
    <main className="mx-auto w-full max-w-[820px] px-4 py-8 font-zen">
      {/* パンくず */}
      <nav className="mb-4 text-sm">
        <Link href="/guides/sales" className="text-[#00a1e9] hover:underline">
          販売ガイドライン
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-600">NFTとは</span>
      </nav>

      {/* ヘッダー */}
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">NFTとは</h1>
        <p className="mt-3 text-gray-700">
          NFT（エヌエフティー）は「Non-Fungible Token（非代替性トークン）」の略で、
          ブロックチェーン上に記録される<strong>デジタル所有権の証明</strong>です。
          画像や音声などのデジタルデータ自体は複製できますが、
          NFTは<strong>「正規の所有者」</strong>をブロックチェーンに記録して可視化します。
        </p>
      </header>

      {/* 一般的な基本 */}
      <Section icon={<Info className="h-5 w-5" />} title="1. NFTの特徴">
        <ul className="list-disc list-inside space-y-2 text-gray-800">
          <li>コピー可能なデジタルデータに「唯一の所有権」を与える仕組み。</li>
          <li>所有者や取引履歴がブロックチェーンに記録され、改ざんが困難。</li>
          <li>アート、音楽、動画、ゲームアイテムなど幅広く活用が進む。</li>
        </ul>
      </Section>

      <Section icon={<Layers className="h-5 w-5" />} title="2. データと所有権の違い">
        <p className="text-gray-800">
          デジタルファイル（画像等）は複製できますが、NFTは
          <strong>「その作品の正規のトークン所有者は誰か」</strong>
          を示します。つまり<strong>ファイル自体</strong>と<strong>所有権トークン</strong>は別物です。
        </p>
      </Section>

      {/* me-ish固有の説明（簡潔） */}
      <Section icon={<Brush className="h-5 w-5" />} title="3. me-ishではだれがNFT化（mint）しますか？">
        <div className="space-y-2 text-gray-800">
          <p>
            me-ish では、<strong>運営側が作品情報をもとにNFT化（mint）</strong>
            を行います（作者の負担を減らし、体験を簡潔にするため）。
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>作者は通常どおり作品を出展（応募）するだけでOK。</li>
            <li>mint後はブロックチェーンに記録され、以降の所有履歴が可視化されます。</li>
          </ul>
        </div>
      </Section>

      {/* 所有権・著作権の整理 */}
      <Section icon={<BadgeCheck className="h-5 w-5" />} title="4. 所有権（トークン）と著作権の考え方">
        <ul className="list-disc list-inside space-y-2 text-gray-800">
          <li>
            NFTの所有＝<strong>トークンの所有権</strong>を指します。
            これは「そのエディションを正規に入手した」という証明です。
          </li>
          <li>
            <strong>著作権（Copyright）は作者に残ります。</strong>
            画像の再配布・商用利用・二次創作などの可否は、ガイドラインや個別規約に従います。
          </li>
          <li>
            一般に、<strong>トークン所有だけで著作権が移転することはありません</strong>（別途合意が必要）。
          </li>
        </ul>
        <NftSimpleDiagram />
      </Section>

      {/* セキュリティ/所有の透明性 */}
      <Section icon={<Lock className="h-5 w-5" />} title="5. 透明性と安心感">
        <ul className="list-disc list-inside space-y-2 text-gray-800">
          <li>所有履歴が公開台帳に記録され、出所や譲渡経路が追跡しやすい。</li>
          <li>作者は正規の購入者に対して特典や証明を提供しやすい。</li>
        </ul>
      </Section>

      {/* フッターCTA */}
      <footer className="mt-10 flex flex-wrap gap-3 text-sm">
        <Link
          href="/guides/sales"
          className="inline-flex items-center justify-center rounded-full border border-[#00a1e9]/40 bg-white px-4 py-2 text-[#00a1e9] transition hover:border-[#00a1e9]/60 hover:bg-[#00a1e9]/5"
        >
          販売ガイドラインに戻る
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2 transition hover:bg-gray-50"
        >
          トップページ
        </Link>
      </footer>
    </main>
  );
}
