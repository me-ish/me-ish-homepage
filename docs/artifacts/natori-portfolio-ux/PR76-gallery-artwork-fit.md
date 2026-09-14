# PR76 Gallery artwork fit

## 目的

Gallery一覧の3:4カード枠を維持しつつ、縦長・横長作品の構図をトリミングせずに見せる。

## 実装

- `#gallery` 内の作品カード画像だけを `object-fit: contain` に上書き
- カードの空き領域は既存のポートフォリオ配色を使った淡い背景で埋める
- 3:4カード比率、スマホ2列、PC3列、既存のマスキングテープ風装飾を維持
- 拡大モーダル、作品順、カテゴリ絞り込み、関連リンク、Hero、Pricing、フォームには変更なし
- `/natori/portfolio` と `/natori/works` は共通の `PortfolioLanding` / `PortfolioStyles` を使うため両方に反映

## テスト

- Galleryカード限定のcontain指定を静的テストで固定
- 3:4比率と2列/3列グリッド維持を確認
- 拡大モーダルの既存 `object-contain` 維持を確認
