'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

type QA = { question: string; answer: React.ReactNode };
type Category = { title: string; items: QA[] };

/** JSX からプレーンテキストを抽出（入れ子も対応） */
const nodeToText = (n: React.ReactNode): string => {
  if (n === null || n === undefined || typeof n === 'boolean') return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(nodeToText).join(' ');
  if (React.isValidElement(n)) return nodeToText(n.props?.children);
  return '';
};

export default function FAQPage() {
  const categories: Category[] = [
    {
      title: '基本情報・概要',
      items: [
        {
          question: 'me-ishとは何ですか？',
          answer: (
            <>
              me-ish（ミーイッシュ）は、アーティストが自分らしく作品を展示・販売できるオンラインギャラリーです。
              肩書きや実績に関係なく、作品そのものを主役に据えるキュレーションを行います。
            </>
          ),
        },
        {
          question: 'どんなアートが展示されていますか？',
          answer: (
            <>
              デジタルアート、イラスト、現代アート、写真などジャンルは不問です。
              なお、<strong>生成AI作品の出展は不可</strong>です（
              <Link href="/footer/copyright" className="underline">著作権・AI学習防止ポリシー 第4条</Link>）。
            </>
          ),
        },
        {
          question: '誰でも作品を出展できますか？',
          answer: (
            <>
              はい。<strong>審査制</strong>です（オリジナル性、テーマ適合、安全性などを確認）。
              応募方法は <Link href="/contact/form" className="underline">お問い合わせフォーム</Link> からご案内します。
            </>
          ),
        },
      ],
    },
    {
  title: '出展について',
  items: [
    {
      question: '出展するにはどうすればいいですか？',
      answer: (
        <>
          {' '}
          <Link href="/entry" className="underline">
            応募フォーム
          </Link>{' '}
          からご応募ください。
          不明点がある場合は{' '}
          <Link href="/contact/form" className="underline">
            お問い合わせフォーム
          </Link>{' '}
          からご連絡ください。
        </>
      ),
    },
    {
      question: '審査基準は？',
      answer: (
        <>
          主に（1）<strong>オリジナル作品</strong>であること、（2）テーマや展示方針に適合すること、
          （3）法令や規約に抵触しないこと（権利侵害・公序良俗違反の排除）などです。
          エントリー方法は{' '}
          <Link href="/entry" className="underline">
            応募フォーム
          </Link>{' '}
          の案内をご確認ください。ご不明点は{' '}
          <Link href="/contact/form" className="underline">
            お問い合わせ
          </Link>
          へ。
        </>
      ),
    },
    {
      question: '出展料はかかりますか？',
      answer: (
        <>
          β版期間は<strong>出展無料</strong>です。正式リリース後は販売時に手数料（例：販売価格の5%）が発生します。
          最新の料率は{' '}
          <Link href="/footer/tokushoho" className="underline">
            特商法表記
          </Link>{' '}
          をご確認ください。
        </>
      ),
    },
    {
      question: '展示期間は？',
      answer: <>目安は約90日です。企画や回遊状況により前後する場合があります（SOLD後も表示継続あり）。</>,
    },
    {
      question: '生成AI作品は出展できますか？',
      answer: (
        <>
          できません。<strong>生成AIによる作品の出展は禁止</strong>です（
          <Link href="/footer/copyright" className="underline">
            ポリシー 第4条
          </Link>
          ）。
        </>
      ),
    },
  ],
},
    {
      title: '作品販売について',
      items: [
        {
          question: '購入方法は？',
          answer: (
            <>
              作品ページの「購入する」から手続きしてください。決済は<strong>クレジットカード</strong>に対応しています
              （NFT販売は Paper 経由のカード決済対応。詳細は作品ページをご確認ください）。
            </>
          ),
        },
        {
          question: '通常販売とNFT販売の違いは？',
          answer: (
            <>
              <strong>通常販売</strong>はデジタルデータの納品（メールやダウンロード）。<strong>NFT販売</strong>はブロックチェーン上の
              <strong>所有証明（NFT）</strong>が発行されます。いずれも<strong>著作権は移転しません</strong>（
              <Link href="/footer/terms" className="underline">利用規約 第8条</Link>）。
            </>
          ),
        },
        {
          question: 'キャンセル・返金はできますか？',
          answer: (
            <>
              デジタル商品の性質上、<strong>原則不可</strong>です。重複決済や重大な不具合等は
              <Link href="/contact/form" className="underline">お問い合わせ</Link> ください（
              <Link href="/footer/terms" className="underline">利用規約 第9条</Link>）。
            </>
          ),
        },
        {
          question: '購入後の確認方法は？',
          answer: (
            <>
              通常販売：メール通知やダウンロードリンクで納品。NFT販売：購入完了メールやご自身のウォレットで確認できます。
            </>
          ),
        },
      ],
    },
    {
      title: 'NFT・デジタル購入関連',
      items: [
        {
          question: 'NFTとは？',
          answer: (
            <>
              ブロックチェーン上で唯一性を証明するデジタル資産です（Non-Fungible Token）。
              所有証明として機能しますが、知的財産権の移転を意味しません。
            </>
          ),
        },
        {
          question: 'ウォレットは必要？',
          answer: (
            <>
              購入時はカードのみで完結できる場合があります。<br />
              ただし、<strong>外部送付・二次流通を行う場合はウォレットの準備が必要</strong>です（作品ページの案内に従ってください）。
            </>
          ),
        },
        {
          question: '他マーケットで転売できる？',
          answer: (
            <>
              ウォレットへ移動できれば可能な場合があります。ただし、<strong>転売を推奨するものではありません</strong>。
              二次流通時のトラブルについて当サービスは責任を負いません（
              <Link href="/footer/disclaimer" className="underline">免責事項 第4条</Link>）。
            </>
          ),
        },
      ],
    },
    {
      title: 'ギャラリーの仕組み・体験',
      items: [
        { question: '無料で閲覧できますか？', answer: <>はい、無料で閲覧できます。アカウント登録も不要です。</> },
        { question: '対応端末は？', answer: <>PC・スマホの主要ブラウザに対応しています（高解像度作品はPC推奨）。</> },
        { question: 'ログインが必要な機能は？', answer: <>通常の閲覧・購入は不要です。運営・管理者向けページのみログインが必要です。</> },
      ],
    },
    {
      title: '安全性・運営方針',
      items: [
        {
          question: '著作権の扱いは？',
          answer: (
            <>
              作品の著作権はアーティストに帰属します。me-ishが著作権を取得することはありません（
              <Link href="/footer/copyright" className="underline">ポリシー 第1条</Link>）。
            </>
          ),
        },
        {
          question: 'AI学習防止の対策は？',
          answer: (
            <>
              <strong>ウォーターマーク、ステガノグラフィー、微細ノイズ付加</strong>等を適宜実施します（恒久的効果を保証するものではありません／
              <Link href="/footer/copyright" className="underline">第3条</Link>）。
            </>
          ),
        },
        {
          question: '個人情報の取扱いは？',
          answer: (
            <>
              <Link href="/footer/privacy" className="underline">プライバシーポリシー</Link> に従い、適切に管理します。
              開示・訂正・削除のご請求は <Link href="/contact/form" className="underline">お問い合わせフォーム</Link> から。
            </>
          ),
        },
        {
          question: '作品データの保存・保護は？',
          answer: (
            <>
              クラウド等で適切に管理しますが、<strong>常時の可用性は保証されません</strong>（
              <Link href="/footer/disclaimer" className="underline">免責事項 第3条</Link>）。
            </>
          ),
        },
      ],
    },
    {
      title: '運営・サポート',
      items: [
        {
          question: '運営者情報は？',
          answer: (
            <>
              運営者は個人事業主「〇〇〇〇（フリガナ）」です。
              詳細は <Link href="/footer/tokushoho" className="underline">特定商取引法に基づく表記</Link> をご確認ください。
            </>
          ),
        },
        {
          question: '問い合わせ方法は？',
          answer: (
            <>
              <Link href="/contact/form" className="underline">お問い合わせフォーム</Link> をご利用ください。
              併せて <span>info [at] me-ish.art</span> でも受け付けます（送信時は「@」に置換）。
            </>
          ),
        },
        {
          question: '連絡はどのように届きますか？',
          answer: <>応募／購入時に登録いただいたメールアドレス宛にご連絡します。</>,
        },
      ],
    },
  ];

  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    if (!q.trim()) return categories;
    const kw = q.trim().toLowerCase();

    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (it) =>
            it.question.toLowerCase().includes(kw) ||
            nodeToText(it.answer).toLowerCase().includes(kw)
        ),
      }))
      .filter((c) => c.items.length > 0);
  }, [categories, q]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">よくある質問（FAQ）</h1>
        <p className="mt-2 text-sm text-gray-600">
          困ったときは <Link href="/contact/form" className="underline">お問い合わせフォーム</Link> へ。通常1–3営業日で返信します。
        </p>
        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="キーワードで検索（例：NFT、返金、出展）"
            className="w-full rounded-lg border px-3 py-2"
          />
        </div>
      </header>

      <section className="space-y-4">
        {filtered.map((category, idx) => (
          <div key={idx} className="rounded-2xl border">
            <button
              onClick={() => setOpen((p) => (p === idx ? null : idx))}
              className="w-full text-left px-4 py-3 font-semibold bg-gray-50 rounded-2xl"
            >
              {category.title}
            </button>
            {open === idx && (
              <ul className="px-5 py-4 space-y-4">
                {category.items.map((item, qIdx) => (
                  <li key={qIdx}>
                    <div className="font-medium">Q. {item.question}</div>
                    <div className="pl-4 mt-1">A. {item.answer}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-gray-600">
            一致する質問が見つかりませんでした。キーワードを変えてお試しください。
          </p>
        )}
      </section>

      <footer className="mt-10 text-sm text-gray-600">最終更新：2025年8月</footer>
    </main>
  );
}
