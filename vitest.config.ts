import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // tsconfig の jsx は Next の "preserve" のため、テスト変換側で automatic runtime を使う
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'node',
    // component test は各ファイル冒頭の `// @vitest-environment jsdom` で
    // 環境を切り替える（既定は node のまま）。
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/**/__tests__/**'],
      thresholds: {
        statements: 20,
        branches: 20,
        functions: 20,
        lines: 20,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
