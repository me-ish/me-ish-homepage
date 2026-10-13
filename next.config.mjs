// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */

// Supabase のホスト名を env から取得
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_HOST = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : '';

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
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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

  webpack: (config, { isServer }) => {
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
