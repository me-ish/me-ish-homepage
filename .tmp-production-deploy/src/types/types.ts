// src/types/types.ts
export interface Entry {
  id: string;

  title?: string;
  author?: string;
  description?: string;

  imageUrl: string;

  price?: number;

  /** 販売関連 */
  is_for_sale?: boolean;
  is_sold?: boolean;

  /** SNS等（現状 string のまま維持） */
  sns_links?: string;

  created_at?: string;

  /** 販売種別：通常販売のみ（または未設定） */
  sale_type?: "normal";

  likes?: number;

  /** エディション */
  edition_total?: number | null;
  edition_sold?: number | null;
}
