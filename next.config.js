/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 外部画像の許可先（必要最低限）
  images: {
    remotePatterns: [
      // Supabase Storage（public/signedどちらでも）
      { protocol: 'https', hostname: '**.supabase.co' },

      // もしOAuthの素のアバターURLをそのまま使う可能性があるなら（任意）
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google
      { protocol: 'https', hostname: 'pbs.twimg.com' },             // X(Twitter)
    ],
  },

  // ビルドID（現状のままでOK / 必須ではない）
  generateBuildId: async () => {
    return 'build-' + Date.now();
  },
};

module.exports = nextConfig;
