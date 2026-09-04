// features/natori/types/links.ts
// /natori/links (リンク集) の掲載内容の型。

export type NatoriLinkItem = {
  /** 並び替え・編集用の固有ID */
  id: string;
  /** 表示名（例: X（Twitter）） */
  label: string;
  /** サブテキスト（例: @natonato_o）。空でもよい */
  sub: string;
  /** リンク先。"/" 始まりはサイト内リンク（同一タブで開く） */
  href: string;
};

export type NatoriLinksContent = {
  links: NatoriLinkItem[];
};
