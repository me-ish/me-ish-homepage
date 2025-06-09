// src/types/types.ts
export interface Entry {
  id: string;
  title?: string;
  author?: string;
  description?: string;
  imageUrl: string;
  price?: number;
  is_for_sale?: boolean;
  is_sold?: boolean;
  sns_links?: string;
  created_at?: string;
  sale_type?: 'normal' | 'nft';
  token_id?: string;
  likes?: number;
}
