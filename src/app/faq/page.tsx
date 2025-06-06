// src/app/faq/page.tsx
'use client';
import React, { useState } from 'react';

export default function FAQ() {
  const categories = [
    {
      title: "基本情報・概要",
      items: [
        { question: "me-ishとは何ですか？", answer: "me-ish（ミーイッシュ）は、すべてのアーティストが自分らしく作品を展示できるオンラインギャラリーです。駆け出しの方から活動歴のある方まで、誰でも自由に作品を発信できる場所を提供しています。" },
        { question: "どんなアートが展示されていますか？", answer: "デジタルアート、NFT作品、イラスト、現代アートなど、ジャンルにとらわれない幅広い作品が展示されています。" },
        { question: "誰でも作品を出展できますか？", answer: "はい、プロ・アマ問わずどなたでもご応募いただけます。me-ishでは、作品そのものを主役とし、肩書きや実績にとらわれない展示を目指しています。" }
      ]
    },
    {
      title: "出展について",
      items: [
        { question: "出展するにはどうすればいいですか？", answer: "応募フォームから作品データと必要情報を送信してください。運営側で審査を行った後、展示の可否をご連絡いたします。" },
        { question: "出展は審査制ですか？審査基準は？", answer: "はい、応募内容に基づく簡単な審査があります。主に『オリジナル作品であるか』『テーマにそぐわない表現でないか』などを確認しています。" },
        { question: "出展料はかかりますか？", answer: "β版期間中は無料で展示できます。正式リリース後は販売時に手数料が発生します（販売価格の5％）。" },
        { question: "展示期間はどれくらいですか？", answer: "通常は約90日間の展示となりますが、ギャラリーごとに異なる場合があります。" },
        { question: "作品が展示されるギャラリーは選べますか？", answer: "基本的に運営側で割り振りを行いますが、希望ギャラリーの指定ができる場合もあります（応募フォームに記載欄あり）。" },
        { question: "生成AI作品は出展できますか？", answer: "いいえ、生成AI（画像生成AI等）による作品の出展は禁止しています。オリジナル作品のみ応募可能です。" },
        { question: "NFT販売にしない通常販売もできますか？", answer: "はい、通常販売（デジタル納品）も対応しています。NFT販売は希望者のみ選択可能です。" }
      ]
    },
    {
      title: "作品販売について",
      items: [
        { question: "作品の購入方法を教えてください。", answer: "ギャラリー内で気に入った作品を選び、『購入する』ボタンから決済手続きを行ってください。クレジットカード決済が利用可能です。" },
        { question: "NFTを購入するには何が必要ですか？", answer: "基本的にはクレジットカードだけで購入可能です。ウォレットを持っていない方でも購入できます。購入後にNFTを受け取るためのウォレット登録を依頼する場合もあります。" },
        { question: "クレジットカードだけで購入できますか？", answer: "はい、通常販売もNFT販売も、クレジットカードで購入可能です。NFTの場合は、Paperというサービスを通じて簡単に決済できます。" },
        { question: "作品購入後のキャンセルや返品はできますか？", answer: "デジタル商品の性質上、原則としてキャンセル・返品はできません。ただし、重大な瑕疵があった場合は運営側で対応いたします。" },
        { question: "購入した作品はどこで確認できますか？", answer: "通常販売の場合はメールまたはダウンロードリンクで納品されます。NFTの場合は、ご自身のウォレットまたは購入完了メールで確認できます。" },
        { question: "NFTを購入すると何が手に入るのですか？", answer: "購入者はブロックチェーン上に登録された『所有証明（NFT）』を受け取ります。デジタル作品のオリジナル所有者であることを示す証拠となります。（※著作権は譲渡されません）" }
      ]
    },
    {
      title: "NFT・デジタル購入関連",
      items: [
        { question: "NFTって何ですか？", answer: "NFT（Non-Fungible Token）は、ブロックチェーン上で唯一無二の存在として証明されるデジタル資産です。デジタルアートの所有権証明として活用されています。" },
        { question: "me-ishで購入したNFTは他のマーケット（OpenSeaなど）で売れますか？", answer: "原則として、Paperを通じた購入NFTはウォレットに移動できれば他のマーケットで転売可能です。ただし、転売を推奨するものではありません。" },
        { question: "購入後、NFTウォレットが必要ですか？", answer: "購入時はウォレットがなくても問題ありませんが、NFTの本格的な管理・転送を行いたい場合はMetaMaskなどのウォレットが必要になります。" },
        { question: "NFT販売と通常販売の違いは何ですか？", answer: "NFT販売はブロックチェーン上で『所有証明（NFT）』が発行され、通常販売は単なるデジタルデータ（ダウンロードやメール納品）となります。" }
      ]
    },
    {
      title: "ギャラリーの仕組み・体験",
      items: [
        { question: "ギャラリーは無料で閲覧できますか？", answer: "はい、どなたでも無料で閲覧可能です。アカウント登録も不要です。" },
        { question: "パソコンとスマートフォン両方で見られますか？", answer: "はい、PC・スマホどちらでも対応しています。ただし、PCの方がより快適な鑑賞体験が可能です。" },
        { question: "ギャラリー内で何ができますか？", answer: "作品を自由に鑑賞したり、作品の詳細情報を確認したり、購入することができます。" },
        { question: "ログインしないと利用できない機能はありますか？", answer: "通常閲覧・購入についてはログイン不要でご利用いただけます。管理者向けページのみログインが必要です。" },
        { question: "ギャラリーには順路やストーリーがありますか？", answer: "基本的には自由鑑賞型ですが、テーマ展示や特別展示ではストーリー仕立ての案内を行うこともあります。" }
      ]
    },
    {
      title: "安全性・運営方針",
      items: [
        { question: "著作権は誰に帰属しますか？", answer: "作品の著作権は、出展したアーティストに帰属します。me-ishは著作権を取得しません。" },
        { question: "出展作品にはAI学習防止処理がされていますか？", answer: "はい、ウォーターマークやステガノグラフィー等を施し、無断学習を防止する取り組みを行っています。" },
        { question: "個人情報はどのように取り扱われますか？", answer: "プライバシーポリシーに基づき、適切に管理し、無断提供や販売は一切行いません。" },
        { question: "作品データの保存・保護対策はされていますか？", answer: "はい、Supabase等のクラウド管理を行い、外部アクセスからの保護にも配慮しています。" }
      ]
    },
    {
      title: "運営・サポート",
      items: [
        { question: "運営者情報を教えてください。", answer: "運営者は個人事業主『〇〇〇〇（〇〇〇〇）』です。詳細は『特定商取引法に基づく表記』をご参照ください。" },
        { question: "問い合わせはどこからできますか？", answer: "サイト内のお問い合わせセクション、またはメール（info@me-ish.art）よりご連絡ください。" },
        { question: "運営からの連絡はどのように届きますか？", answer: "応募時や購入時に登録いただいたメールアドレス宛に連絡を行います。" }
      ]
    }
  ];

  const [openCategory, setOpenCategory] = useState<number | null>(null);

  const toggleCategory = (index: number) => {
    setOpenCategory(prev => prev === index ? null : index);
  };
  
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>よくある質問（FAQ）</h1>
      {categories.map((category, idx) => (
        <div key={idx} style={{ marginBottom: '2rem' }}>
          <h2 
            onClick={() => toggleCategory(idx)}
            style={{ cursor: 'pointer', background: '#f0f0f0', padding: '0.5rem', borderRadius: '8px' }}
          >
            {category.title}
          </h2>
          {openCategory === idx && (
            <ul style={{ marginTop: '1rem', paddingLeft: '1rem' }}>
              {category.items.map((item, qIdx) => (
                <li key={qIdx} style={{ marginBottom: '1rem' }}>
                  <strong>Q. {item.question}</strong>
                  <p style={{ marginLeft: '1rem' }}>A. {item.answer}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
