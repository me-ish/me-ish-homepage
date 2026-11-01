// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */

// Supabase のホスト名を env から取得
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_HOST = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : '';

function isEphemeralTestApp() {
  return Object.entries(process.env).some(
    ([key, value]) => /^PHASE_[A-Z0-9]+_BROWSER$/.test(key) && value === 'ephemeral'
  );
}

const nextConfig = {
  // The image ceiling remains 10 MiB; middleware also buffers multipart headers.
  // A bounded extra MiB prevents truncating a valid file at that exact ceiling.
  experimental: { middlewareClientMaxBodySize: '11mb' },
  images: {
    // Supabase Storage の公開URLを許可
    // 例) https://<project>.supabase.co/storage/v1/object/public/avatars/...
    remotePatterns: SUPABASE_HOST
      ? [
          {
            protocol: 'https',
            hostname: SUPABASE_HOST,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },

  // The retired /natori page redirects in its page component too, but the
  // global loading boundary streams that as a 200 with a meta refresh. A
  // config redirect answers with a real 308 before rendering.
  async redirects() {
    return [
      { source: '/natori', destination: '/natori/portfolio', permanent: true },
      { source: '/ja/natori', destination: '/natori/portfolio', permanent: true },
      { source: '/en/natori', destination: '/en/natori/portfolio', permanent: true },
      // 旧作品ページ（静的な works.ts・VGen 導線・旧配色）は廃止。作品はポートフォリオの実績へ。
      { source: '/natori/works/:slug', destination: '/natori/portfolio', permanent: true },
      { source: '/ja/natori/works/:slug', destination: '/natori/portfolio', permanent: true },
      { source: '/en/natori/works/:slug', destination: '/en/natori/portfolio', permanent: true },
    ];
  },

  async headers() {
    // Content-Security-Policy はまず Report-Only で配る（違反はブラウザのコンソールに出るだけで、表示は止めない）。
    // 相談・見積・納品ページはトークンが URL にあるため、XSS の最後の防壁として入れる。
    // script-src に 'unsafe-inline' が残るのは、Next の inline script と GA の初期化に nonce を
    // まだ配っていないため。nonce 配布（middleware）に移したら外す。
    const supabaseOrigin = SUPABASE_HOST ? `https://${SUPABASE_HOST}` : '';
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.stripe.com",
      `img-src 'self' data: blob: ${supabaseOrigin} https://www.googletagmanager.com https://*.google-analytics.com`.trim(),
      `media-src 'self' blob: ${supabaseOrigin}`.trim(),
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://va.vercel-scripts.com",
      `connect-src 'self' ${supabaseOrigin} ${SUPABASE_HOST ? `wss://${SUPABASE_HOST}` : ''} https://*.google-analytics.com https://www.googletagmanager.com https://vitals.vercel-insights.com https://va.vercel-scripts.com`.replace(/\s+/g, ' ').trim(),
      "frame-src https://www.youtube-nocookie.com https://www.youtube.com",
      "worker-src 'self' blob:",
    ].join('; ').replace(/\s{2,}/g, ' ');
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy-Report-Only', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },

  webpack: (config, { dev, isServer }) => {
    // CI の使い捨て試験アプリ（PHASE_*_BROWSER=ephemeral）で next dev を動かすときだけ、
    // webpack のディスクキャッシュをメモリに切り替える。ディスクのキャッシュは書き換えの途中で
    // 読まれると "Unexpected end of JSON input" になり、試験が全件成功でもジョブが落ちていた。
    // 本番ビルドと普段の開発には影響しない。
    if (dev && isEphemeralTestApp()) {
      config.cache = { type: 'memory' };
    }
    if (!isServer) {
      config.resolve.alias['pino-pretty'] = false;
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        module: false,
        readline: false,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
