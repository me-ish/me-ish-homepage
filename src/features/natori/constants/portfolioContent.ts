// features/natori/constants/portfolioContent.ts
// /natori/portfolio (コミッション用ポートフォリオ) の掲載内容
// 名前・作品・料金・SNSリンクはすべてここに集約。差し替えはこのファイルだけでOK。

import type {
  PortfolioArtwork,
  PortfolioPlan,
  PortfolioSocialLink,
} from "@/features/natori/types/portfolio";

/* ------------------------------------------------------------------
   カラートークン
   ここを書き換えるだけで全体の配色を調整できます
------------------------------------------------------------------- */
export const portfolioColors = {
  paper: "#F7F3FB",
  paperAlt: "#EFE7F7",
  ink: "#2D2A3D",
  inkSoft: "#5B5670",
  pink: "#FF6FA5",
  pinkDeep: "#E84C86",
  mint: "#6FE0C3",
  mintDeep: "#3FBE9E",
  yellow: "#FFD166",
  peach: "#FFB199",
  card: "#FFFFFF",
  tape: "#FFE8A3",
} as const;

const c = portfolioColors;

/** コミッション受付中 / 停止中はここを切り替え */
export const commissionOpen = true;

/* ------------------------------------------------------------------
   プロフィール（ダミー。公開前に差し替え）
------------------------------------------------------------------- */
export const portfolioProfile = {
  artistName: "Yukino* illust",
  roleEn: "Chibi & Anime Illustrator",
  heroTitleLead: "ちいさくて、かわいい。",
  heroTitleAccent: "あなたの推し",
  heroTitleTail: "を描きます",
  heroDescription:
    "ちびキャラ・バストアップ・全身イラストを中心に、あたたかみのあるアニメ調の絵柄で制作しています。Live2D化を前提にしたレイヤー分け納品にも対応。",
  aboutText:
    "アニメ・chibiスタイルを中心に活動しているイラストレーターです。あたたかみのある線と、キャラクターの「かわいい瞬間」を切り取った絵柄が好みです。ファンアート・オリジナルキャラクターどちらのご依頼も歓迎しています。",
  live2dNoteTitle: "Live2Dリギングもまとめて対応できます",
  live2dNoteBody:
    "夫がLive2Dリギングを専門にしているため、「イラスト+リギング」をワンストップでご依頼いただけます。動かすことを前提にしたレイヤー分けイラストのご相談もお気軽にどうぞ。",
  copyright: "© 2026 Yukino* illust. All illustrations placeholder.",
} as const;

/* ------------------------------------------------------------------
   作品ギャラリー（プレースホルダー。実画像への差し替え前提）
------------------------------------------------------------------- */
export const portfolioGalleryFilters = [
  "すべて",
  "ちびキャラ",
  "バストアップ",
  "全身",
  "Live2D対応",
] as const;

export const portfolioArtworks: PortfolioArtwork[] = [
  { id: 1, title: "夏色スケッチ", tag: "バストアップ", skin: "#FFE3D1", hair: "#B98BD8", accent: c.pink, rotate: "-rotate-3" },
  { id: 2, title: "おひるねちゃん", tag: "ちびキャラ", skin: "#FFE9DA", hair: "#7FD9C4", accent: c.mint, rotate: "rotate-2" },
  { id: 3, title: "制服ver.", tag: "全身", skin: "#FDE0D0", hair: "#F3A6C1", accent: c.peach, rotate: "rotate-1" },
  { id: 4, title: "推し色コーデ", tag: "Live2D対応", skin: "#FFE3D1", hair: "#FFC15E", accent: c.yellow, rotate: "-rotate-2" },
  { id: 5, title: "ふわもこパーカー", tag: "バストアップ", skin: "#FFE9DA", hair: "#9AB8F0", accent: c.mint, rotate: "rotate-3" },
  { id: 6, title: "きらきら配信衣装", tag: "Live2D対応", skin: "#FDE0D0", hair: "#E893B0", accent: c.pink, rotate: "-rotate-1" },
];

/* ------------------------------------------------------------------
   コミッション料金プラン（ダミー価格）
------------------------------------------------------------------- */
export const portfolioPlans: PortfolioPlan[] = [
  {
    name: "ちびキャラ",
    price: "$25〜",
    desc: "SD／デフォルメスタイルの1体絵",
    features: ["背景シンプル", "納期 5〜7日", "修正1回まで"],
    color: c.mint,
    badge: null,
  },
  {
    name: "バストアップ",
    price: "$45〜",
    desc: "胸から上のフルカラーイラスト",
    features: ["背景カラー1色", "納期 7〜10日", "修正2回まで"],
    color: c.pink,
    badge: "人気No.1",
  },
  {
    name: "全身イラスト",
    price: "$80〜",
    desc: "全身+簡易背景の1枚絵",
    features: ["背景イラスト付き", "納期 10〜14日", "修正2回まで"],
    color: c.peach,
    badge: null,
  },
  {
    name: "Live2D対応セット",
    price: "$150〜",
    desc: "リギング前提のレイヤー分けイラスト",
    features: ["パーツ分け納品", "夫によるリギング相談可", "納期 応相談"],
    color: c.yellow,
    badge: "夫婦コンビ限定",
  },
];

/* ------------------------------------------------------------------
   フォームの予算選択肢
------------------------------------------------------------------- */
export const portfolioBudgetOptions = [
  "〜$50",
  "$50〜$100",
  "$100〜$200",
  "$200以上",
] as const;

/* ------------------------------------------------------------------
   SNSリンク（ダミー。公開前に差し替え）
------------------------------------------------------------------- */
export const portfolioSocialLinks: PortfolioSocialLink[] = [
  { label: "X (Twitter)", href: "#" },
  { label: "VGen", href: "#" },
  { label: "Pixiv", href: "#" },
];
