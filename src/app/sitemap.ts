// src/app/sitemap.ts
import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.me-ish.art';

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    // トップ・メイン
    { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/float`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/float/2d`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/white`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/white/2d`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },

    // AURA
    { url: `${SITE_URL}/aura`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },

    // 情報ページ
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/entry`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/news`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },

    // フッター（法的文書）
    { url: `${SITE_URL}/footer/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/footer/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/footer/tokushoho`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/footer/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/footer/copyright`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/footer/disclaimer`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },

    // その他
    { url: `${SITE_URL}/special-thanks`, lastModified: now, changeFrequency: 'monthly', priority: 0.2 },
  ];

  // 動的ページ
  const dynamicPages: MetadataRoute.Sitemap = [];

  const admin = supabaseAdmin();
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
            url: `${SITE_URL}/works/${entry.id}`,
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
              url: `${SITE_URL}/aura/u/${aura.public_slug}`,
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
            url: `${SITE_URL}/artists/${portfolio.user_id}`,
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
