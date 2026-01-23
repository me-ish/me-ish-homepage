// src/lib/portfolio/types.ts

export type PortfolioMode = 'template' | 'aura';

export type PortfolioProfile = {
  id: string;
  user_id: string;
  public_slug: string | null;
  is_public: boolean;
  mode: PortfolioMode;
  aura_request_id: string | null;
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
  job_status?: 'queued' | 'running' | 'succeeded' | 'failed' | null;
  view_count?: number;
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
