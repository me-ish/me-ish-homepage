// src/lib/portfolio/types.ts

export type PortfolioMode = 'template' | 'aura';

export type WorksFilter = 'displaying' | 'for_sale' | 'all';
export type SortKey = 'new' | 'likes';

export type PortfolioSettings = {
  user_id: string;
  is_public: boolean;
  works_filter: WorksFilter;
  sort_key: SortKey;
  created_at?: string;
  updated_at?: string;
};

export type PortfolioProfile = {
  id: string;
  user_id: string;
  public_slug: string | null;
  is_public: boolean;
  mode: PortfolioMode;
  aura_request_id: string | null;
  works_filter: WorksFilter;
  sort_key: SortKey;
  created_at: string;
  updated_at: string;
};

export type LikedEntry = {
  id: number;
  title: string;
  image_url: string;
  artist_name?: string;
  likes: number;
  liked_at: string;
};

export type EntryWithStatus = {
  id: number;
  title: string;
  image_url: string;
  confirmed: boolean | null;
  display_ready: boolean | null;
  display_start_at: string | null;
  display_end_at: string | null;
  confirmed_at: string | null;
  likes: number;
  created_at: string;
  gallery_type?: string | null;
  edition_total?: number | null;
  edition_sold?: number | null;
  price?: number | null;
  is_sold?: boolean | null;
  is_for_sale?: boolean | null;
  portfolio_hidden?: boolean;
  job_status?: 'queued' | 'running' | 'succeeded' | 'failed' | null;
  job_error?: string | null;
  job_attempts?: number | null;
  job_updated_at?: string | null;
  view_count?: number;
  rejected_at?: string | null;
  reject_reason?: string | null;
  // 同意設定
  agree_promotion?: boolean;
  agree_storage?: boolean;
  // 有料プラン関連
  display_plan?: string | null;
  plan_payment_status?: string | null;
  guarantee_total?: number | null;
  guarantee_remaining?: number | null;
  guarantee_period_end?: string | null;
};

export type TemplateContent = {
  profile: {
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    sns_links: {
      homepage?: string;
      twitter?: string;
      instagram?: string;
    } | null;
  };
  entries: Array<{
    id: number;
    title: string;
    image_url: string;
  }>;
};

export type PublicPortfolioData = PortfolioProfile & {
  profile: {
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    sns_links: Record<string, string> | null;
  } | null;
};
