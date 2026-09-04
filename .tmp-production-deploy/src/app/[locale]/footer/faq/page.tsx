"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

type QA = { question: string; answer: React.ReactNode };
type Category = { title: string; items: QA[] };

/** JSX からプレーンテキストを抽出（入れ子も対応） */
const nodeToText = (n: React.ReactNode): string => {
  if (n === null || n === undefined || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(nodeToText).join(" ");
  if (React.isValidElement(n)) return nodeToText((n.props as any)?.children);
  return "";
};

/**
 * FAQ の原文データ（レンダーごとに再生成しない）
 *  */
const FAQ_CATEGORIES: Category[] = [
  {
    title: "基本情報・概要",
    items: [
      {
        question: "me-ishとは何ですか？",
        answer: (
          <>
            me-ish（ミーイッシュ）は、アーティストが自分らしく作品を展示・販売できるオンラインギャラリーです。
            肩書きや実績に関係なく、作品そのものを主役に据えるキュレーションを行います。
          </>
        ),
      },
      {
        question: "どんなアートが展示されていますか？",
        answer: (
          <>
            デジタルアート、イラスト、現代アートなどジャンルは不問です。
            なお、<strong>生成AI作品の出展は不可</strong>です（{" "}
            <Link href="/footer/copyright" className="underline underline-offset-2">
              著作権・AI学習防止ポリシー 第4条
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "誰でも作品を出展できますか？",
        answer: (
          <>
            はい。<strong>審査制</strong>です（オリジナル性、テーマ適合、安全性などを確認）。
            応募は{" "}
            <Link href="/entry" className="underline underline-offset-2">
              応募フォーム
            </Link>{" "}
            から。不明点は{" "}
            <Link href="/contact" className="underline underline-offset-2">
              お問い合わせ
            </Link>{" "}
            へ。
          </>
        ),
      },
    ],
  },
  {
    title: "出展について",
    items: [
      {
        question: "出展するにはどうすればいいですか？",
        answer: (
          <>
            <Link href="/entry" className="underline underline-offset-2">
              応募フォーム
            </Link>{" "}
            からご応募ください。不明点がある場合は{" "}
            <Link href="/contact" className="underline underline-offset-2">
              お問い合わせフォーム
            </Link>{" "}
            からご連絡ください。
          </>
        ),
      },
      {
        question: "審査基準は？",
        answer: (
          <>
            主に（1）<strong>オリジナル作品</strong>であること、（2）テーマや展示方針に適合すること、
            （3）法令や規約に抵触しないこと（権利侵害・公序良俗違反の排除）などです。
            エントリー方法は{" "}
            <Link href="/entry" className="underline underline-offset-2">
              応募フォーム
            </Link>{" "}
            の案内をご確認ください。ご不明点は{" "}
            <Link href="/contact" className="underline underline-offset-2">
              お問い合わせ
            </Link>{" "}
            へ。
          </>
        ),
      },
      {
        question: "出展料はかかりますか？",
        answer: (
          <>
            <strong>応募・展示は無料</strong>です。作品が<strong>売れたときだけ手数料10%</strong>を売上から控除します。
            アーティストへのお支払いは<strong>月末締め・翌月25日払い</strong>の銀行振込です（口座登録必須）。
            <strong>最低振込金額の制限なし・振込手数料はme-ish負担</strong>です。
            詳細は{" "}
            <Link href="/footer/terms#sec-7-2" className="underline underline-offset-2">
              利用規約 第7条の2
            </Link>{" "}
            をご確認ください。
          </>
        ),
      },
      {
        question: "展示期間は？",
        answer: (
          <>
            展示可否・期間・配置は運営基準により決定します。購入後も、期間中は「SOLD」表示で掲出を継続する場合があります（{" "}
            <Link href="/footer/terms#sec-6" className="underline underline-offset-2">
              規約 第6条
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "生成AI作品は出展できますか？",
        answer: (
          <>
            できません。<strong>生成AIによる作品の出展は禁止</strong>です（{" "}
            <Link href="/footer/copyright" className="underline underline-offset-2">
              ポリシー 第4条
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "振込額に消費税は含まれていますか？インボイスは発行されますか？",
        answer: (
          <>
            アーティストへの振込額は、<strong>税込販売価格から手数料10%を控除した金額</strong>です。
            消費税の取扱い（課税・免税の判断や申告）は各アーティストの税務ご判断に委ねます。
            なお、me-ishは<strong>適格請求書発行事業者（インボイス登録事業者）ではない</strong>ため、
            適格請求書（インボイス）の発行には対応しておりません（{" "}
            <Link href="/footer/terms#sec-7-2" className="underline underline-offset-2">
              利用規約 第7条の2
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "表示保証オプションはありますか？",
        answer: (
          <>
            はい。任意の<strong>表示保証オプション</strong>を購入すると、<strong>1作品ごと</strong>に
            <strong>購入日から1か月</strong>の有効期間内で所定回数の掲出を保証します。
            <br />
            <span className="text-gray-700">
              ※ 具体的な<strong>料金と保証回数</strong>は最新の{" "}
            </span>
            <Link href="/modal/pricing" className="underline underline-offset-2">
              プランと料金
            </Link>
            <span className="text-gray-700"> をご確認ください。</span>
            <br />
            <span className="text-gray-700">
              ※ 自動更新はありません／<strong>提供開始後・消化済み回数は返金不可</strong>／掲出の時間帯・枠位置は運営裁量です（{" "}
            </span>
            <Link href="/footer/terms#sec-6" className="underline underline-offset-2">
              規約 第6条
            </Link>
            <span className="text-gray-700">）。</span>
          </>
        ),
      },
    ],
  },
  {
    title: "作品購入について",
    items: [
      {
        question: "購入方法は？",
        answer: (
          <>
            作品ページの「購入する」から手続きしてください。支払いは<strong>クレジットカード（Stripe／日本円）</strong>のみです。
            暗号資産での決済には対応していません（{" "}
            <Link href="/footer/terms#sec-7" className="underline underline-offset-2">
              規約 第7条
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "キャンセル・返金はできますか？",
        answer: (
          <>
            デジタル商品の性質上、<strong>原則不可</strong>です。
            ただし、(i) 重複課金、(ii) 当社に起因する引渡不能・重大な不具合で合理的期間内に回復不能、(iii) 法令上の瑕疵がある場合は
            <strong>購入後7日以内</strong>の申出に限り返金等に応じます（{" "}
            <Link href="/footer/terms#sec-9" className="underline underline-offset-2">
              規約 第9条
            </Link>{" "}
            ／{" "}
            <Link href="/footer/tokushoho" className="underline underline-offset-2">
              特商法表記
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "購入後の確認方法は？",
        answer: (
          <>
            決済確認後、<strong>即時〜24時間以内</strong>にメール通知またはダウンロードリンクで納品します（障害時は最長<strong>3営業日</strong>）。
            詳細は{" "}
            <Link href="/footer/tokushoho" className="underline underline-offset-2">
              特商法表記
            </Link>{" "}
            もご確認ください。
          </>
        ),
      },
    ],
  },
  {
    title: "ギャラリーの仕組み・体験",
    items: [
      { question: "無料で閲覧できますか？", answer: <>はい、無料で閲覧できます。アカウント登録も不要です。</> },
      { question: "対応端末は？", answer: <>PC・スマホの主要ブラウザに対応しています（高解像度作品はPC推奨）。</> },
      { question: "ログインが必要な機能は？", answer: <>通常の閲覧・購入は不要です。運営・管理者向けページのみログインが必要です。</> },
    ],
  },
  {
    title: "安全性・運営方針",
    items: [
      {
        question: "著作権の扱いは？",
        answer: (
          <>
            作品の著作権はアーティストに帰属します。me-ishが著作権を取得することはありません（{" "}
            <Link href="/footer/copyright#sec-1" className="underline underline-offset-2">
              ポリシー 第1条
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "AI学習防止の対策は？",
        answer: (
          <>
            <strong>ウォーターマーク、ステガノグラフィー、微細ノイズ付加</strong>等を適宜実施します（恒久的効果は保証しません／{" "}
            <Link href="/footer/copyright#sec-3" className="underline underline-offset-2">
              同 第3条
            </Link>{" "}
            ）。
          </>
        ),
      },
      {
        question: "個人情報の取扱いは？",
        answer: (
          <>
            <Link href="/footer/privacy" className="underline underline-offset-2">
              プライバシーポリシー
            </Link>{" "}
            に従い、適切に管理します。開示・訂正・削除のご請求は{" "}
            <Link href="/contact" className="underline underline-offset-2">
              お問い合わせフォーム
            </Link>{" "}
            から。
          </>
        ),
      },
      {
        question: "作品データの保存・保護は？",
        answer: (
          <>
            クラウド等で適切に管理しますが、<strong>常時の可用性は保証されません</strong>（{" "}
            <Link href="/footer/disclaimer#sec-3" className="underline underline-offset-2">
              免責事項 第3条
            </Link>{" "}
            ）。
          </>
        ),
      },
    ],
  },
  {
    title: "運営・サポート",
    items: [
      {
        question: "運営者情報は？",
        answer: (
          <>
            運営者は個人事業主「大下 唯」です。詳細は{" "}
            <Link href="/footer/tokushoho" className="underline underline-offset-2">
              特定商取引法に基づく表記
            </Link>{" "}
            をご確認ください。
          </>
        ),
      },
      {
        question: "問い合わせ方法は？",
        answer: (
          <>
            <Link href="/contact" className="underline underline-offset-2">
              お問い合わせフォーム
            </Link>{" "}
            をご利用ください。併せて <span>info [at] me-ish.art</span> でも受け付けます（送信時は「@」に置換）。
          </>
        ),
      },
      {
        question: "連絡はどのように届きますか？",
        answer: <>応募／購入時に登録いただいたメールアドレス宛にご連絡します。</>,
      },
    ],
  },
];

export default function FAQPage() {
  const locale = useLocale();
  const t = useTranslations();
  const [openTitle, setOpenTitle] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return FAQ_CATEGORIES;

    return FAQ_CATEGORIES
      .map((c) => ({
        ...c,
        items: c.items.filter((it) => {
          const hay = `${it.question} ${nodeToText(it.answer)}`.toLowerCase();
          return hay.includes(kw);
        }),
      }))
      .filter((c) => c.items.length > 0);
  }, [q]);

  // 検索でカテゴリが消えた/順番が変わったときに、openが不正にならないよう整える
  const visibleTitles = useMemo(() => new Set(filtered.map((c) => c.title)), [filtered]);
  if (openTitle && !visibleTitles.has(openTitle)) {
    // ここは同期的に setState しない（レンダーループ回避）
    // openTitleが見えなくなった場合は、自然に閉じるだけでOK
    // （UX的にも検索結果に合わせて閉じた方が自然）
  }

  if (locale === 'en') {
    return (
      <main className="min-h-[60vh] flex items-center justify-center px-6">
        <p className="text-gray-500 text-center max-w-md">{t('jaOnly')}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">よくある質問（FAQ）</h1>
        <p className="mt-2 text-sm text-gray-600">
          解決しない場合は{" "}
          <Link href="/contact" className="underline underline-offset-2">
            お問い合わせフォーム
          </Link>{" "}
          へ。通常 1–3 営業日を目安に返信します。
        </p>

        <div className="mt-4">
          <label htmlFor="faq-search" className="sr-only">
            FAQを検索
          </label>
          <input
            id="faq-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="キーワードで検索（例：手数料、返金、出展、表示保証）"
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#00a1e9]"
            aria-label="FAQを検索"
          />
        </div>
      </header>

      <section className="space-y-4">
        {filtered.map((category) => {
          const isOpen = openTitle === category.title;

          return (
            <div key={category.title} className="rounded-2xl border">
              <button
                type="button"
                onClick={() => setOpenTitle((p) => (p === category.title ? null : category.title))}
                className={[
                  "w-full text-left px-4 py-3 font-semibold rounded-2xl",
                  "bg-gray-50 hover:bg-gray-100",
                  "focus:outline-none focus:ring-2 focus:ring-[#00a1e9]",
                ].join(" ")}
                aria-expanded={isOpen}
              >
                {category.title}
              </button>

              {isOpen && (
                <ul className="px-5 py-4 space-y-4">
                  {category.items.map((item) => (
                    <li key={item.question} className="leading-relaxed">
                      <div className="font-medium">Q. {item.question}</div>
                      <div className="pl-4 mt-1 text-sm text-gray-800">A. {item.answer}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="rounded-2xl border bg-gray-50 p-4 text-sm text-gray-700">
            一致する質問が見つかりませんでした。キーワードを変えてお試しください。
            <div className="mt-2">
              それでも解決しない場合は{" "}
              <Link href="/contact" className="underline underline-offset-2">
                お問い合わせフォーム
              </Link>{" "}
              へ。
            </div>
          </div>
        )}
      </section>

      <footer className="mt-10 text-xs text-gray-500">最終更新：2026年2月16日</footer>
    </main>
  );
}
