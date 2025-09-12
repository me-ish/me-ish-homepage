// thirdweb-shims.d.ts（プロジェクト直下）

// 1) まず “ぴったり一致” 版（現在のd.tsが参照している実パス）
declare module 'thirdweb/dist/types/react/web/ui/ConnectWallet/defaultTokens.js' {
  export type SupportedTokens = unknown;
  const tokens: SupportedTokens;
  export default tokens;
}

// 2) 念のためのワイルドカード（将来のパス変更に備える保険）
declare module '*/defaultTokens.js' {
  export type SupportedTokens = unknown;
  const tokens: SupportedTokens;
  export default tokens;
}
