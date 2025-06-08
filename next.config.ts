import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 🔽 ビルドごとにユニークなIDを生成して chunk キャッシュを強制リセット
  generateBuildId: async () => {
    return "build-" + Date.now(); // 任意のユニークID
  },
};

export default nextConfig;
