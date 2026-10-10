# 未使用npm uuidの除去

最終依存確認でnpm `uuid` のJavaScript/TypeScript・設定・実行スクリプト参照は0件。
Pythonの`import uuid`はPython標準ライブラリであり、npm packageへの参照ではない。
COA/領収書が動的importするjspdf、Natori/Phaseが使うtus-js-client等は保持する。

`npm uninstall uuid --package-lock-only --ignore-scripts --no-audit --no-fund`を使用。
直接依存uuidとlockのnode_modules/uuid 1件のみ除去。他のpackage objectとバージョンは不変。
PR #152全体の直接依存除去は12本・lock entry78件。
ソース・画面・CSS・DBへの追加変更はない。最終コミットのCI結果はPRと整理計画へ記録する。

復元基準: `3ef93ddcf84b9363510fbb763468537b3af32e76`

```json
[
  {
    "path": "package.json",
    "blob": "23543a27eb095f22819f19507c0baee86a5aa1fb",
    "bytes": 2955,
    "sha256": "3529046fe35fb3a7d1d04b717dde75a073eb8fcea179864ebfdbeed16a83e3f0"
  },
  {
    "path": "package-lock.json",
    "blob": "b6551026939e1e6cb560ce4a3e417edc505281d7",
    "bytes": 503770,
    "sha256": "68d96de647b3ff6f8fd69284f222cdc23156f6df69aa3d3e39b0d478b75cec82"
  }
]
```
