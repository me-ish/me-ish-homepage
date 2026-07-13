// features/natori/constants/linksContent.ts
// /natori/links のデフォルト掲載内容（DB未保存時の初期値）。
// 実際の掲載内容は /natori/links/edit からブラウザで変更できる。
import type { NatoriLinksContent } from "@/features/natori/types/links";

export const defaultNatoriLinksContent: NatoriLinksContent = {
  links: [
    {
      id: "portfolio",
      label: "ポートフォリオ",
      sub: "ご依頼・コミッションはこちら",
      href: "/natori/portfolio",
    },
    {
      id: "x",
      label: "X（Twitter）",
      sub: "@natonato_o",
      href: "https://x.com/natonato_o",
    },
    {
      id: "tiktok",
      label: "TikTok",
      sub: "@natori_draw",
      href: "https://www.tiktok.com/@natori_n?_r=1&_t=ZS-95f2mTSsI5c",
    },
    {
      id: "wick",
      label: "Wick",
      sub: "コミュニティ",
      href: "https://wick-share.com/sns/share/lXY3b8Gw",
    },
    {
      id: "tsunagu",
      label: "つなぐ",
      sub: "フォローはこちら",
      href: "https://tsunagu.cloud/users/natonato_o",
    },
    {
      id: "booth",
      label: "BOOTH",
      sub: "グッズ・同人誌",
      href: "https://natori0716.booth.pm/",
    },
    {
      id: "skeb",
      label: "Skeb",
      sub: "コミッション受付中",
      href: "https://skeb.jp/@natonato_o",
    },
  ],
};
