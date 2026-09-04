// src/app/sitemap.ts
import { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.me-ish.art';

/** hreflang alternates for a given path */
function withAlternates(path: string) {
  const url = path ? `${SITE_URL}/${path}` : SITE_URL;
  return {
    url,
    alternates: {
      languages: {
        ja: url,
        en: path ? `${SITE_URL}/en/${path}` : `${SITE_URL}/en`,
      },
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    // トップ・メイン
    { ...withAlternates(''), lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { ...withAlternates('float'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { ...withAlternates('float/2d'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { ...withAlternates('white'), lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { ...withAlternates('white/2d'), lastModified: now, changeFrequency: 'daily', priority: 0.8 },

    // AURA
    { ...withAlternates('aura'), lastModified: now, changeFrequency: 'weekly', priority: 0.8 },

    // 情報ページ
    { ...withAlternates('contact'), lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { ...withAlternates('entry'), lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { ...withAlternates('news'), lastModified: now, changeFrequency: 'weekly', priority: 0.6 },

    // フッター（法的文書）
    { ...withAlternates('footer/terms'), lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { ...withAlternates('footer/privacy'), lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { ...withAlternates('footer/tokushoho'), lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { ...withAlternates('footer/faq'), lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { ...withAlternates('footer/copyright'), lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { ...withAlternates('footer/disclaimer'), lastModified: now, changeFrequency: 'monthly', priority: 0.3 },

    // その他
    { ...withAlternates('special-thanks'), lastModified: now, changeFrequency: 'monthly', priority: 0.2 },
  ];

  // 動的ページ
  const dynamicPages: MetadataRoute.Sitemap = [];

  let admin;
  try {
    admin = supabaseAdmin();
  } catch {
    // env未設定（ビルド時など）
  }

  if (admin) {
    try {
      // 公開中の作品（confirmed かつ display_ready）
      const { data: entries } = await admin
        .from('entries')
        .select('id, created_at')
        .eq('confirmed', true)
        .eq('display_ready', true)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (entries) {
        for (const entry of entries) {
          dynamicPages.push({
            ...withAlternates(`works/${entry.id}`),
            lastModified: entry.created_at || now,
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }

      // 公開AURAポートフォリオ
      const { data: auraRequests } = await admin
        .from('aura_requests')
        .select('public_slug, published_at')
        .eq('visibility', 'public')
        .eq('payment_status', 'paid')
        .not('public_slug', 'is', null)
        .order('published_at', { ascending: false })
        .limit(500);

      if (auraRequests) {
        for (const aura of auraRequests) {
          if (aura.public_slug) {
            dynamicPages.push({
              ...withAlternates(`aura/u/${aura.public_slug}`),
              lastModified: aura.published_at || now,
              changeFrequency: 'weekly',
              priority: 0.6,
            });
          }
        }
      }

      // 公開アーティストプロフィール（ポートフォリオ設定が公開のもの）
      const { data: portfolios } = await admin
        .from('portfolio_settings')
        .select('user_id, updated_at')
        .eq('is_public', true)
        .limit(500);

      if (portfolios) {
        for (const portfolio of portfolios) {
          dynamicPages.push({
            ...withAlternates(`artists/${portfolio.user_id}`),
            lastModified: portfolio.updated_at || now,
            changeFrequency: 'weekly',
            priority: 0.6,
          });
        }
      }
    } catch (error) {
      console.error('[sitemap] Error fetching dynamic pages:', error);
    }
  }

  return [...staticPages, ...dynamicPages];
}
