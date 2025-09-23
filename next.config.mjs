// next.config.mjs
/** @type {import('next').NextConfig} */

// Supabase のホスト名を env から取得
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_HOST = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : '';

const nextConfig = {
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

export default nextConfig;
