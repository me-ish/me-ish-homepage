// ESLint flat config（Next 16 で `next lint` が無くなったため、ESLint CLI で直接動かす）。
// 中身は旧 .eslintrc.json の `next/core-web-vitals` と同じ。
import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  // 生成物・テスト結果は見ない（.next/ と out/ と build/ は eslint-config-next 側で除外済み）。
  globalIgnores([
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "e2e/.auth/**",
    ".vercel/**",
    ".tmp-production-deploy/**",
    "glaze_out/**",
  ]),
  {
    // eslint-config-next 16 は eslint-plugin-react-hooks 7 の React Compiler 向けルールをエラーで有効にする。
    // Next 15 の `next lint` には無かったルールで、移行時点で既存コードに次の件数の指摘がある:
    //   set-state-in-effect 65 / refs 50 / error-boundaries 23 / immutability 6 / purity 5
    // 直すには画面の挙動に関わる書き換えが要るので、このアップグレードでは警告として見えるようにだけしておき、
    // 別の PR で直してからエラーに戻す。指摘の無い他の新ルールはエラーのまま（新しい違反は止める）。
    // files は eslint-config-next が react-hooks プラグインを登録しているものと同じにする。
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
