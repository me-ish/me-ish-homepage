# エトリエ P0-01 `portfolio_profiles`参照除去

作成日: 2026-07-23（JST）
決定: `portfolio_profiles`は廃止し、新baselineへ含めない

## 結果

現行runtimeから`portfolio_profiles`へのquery、補助関数、schema連動型、初期読込、退会処理の古いコメントを除去した。公開設定のsource of truthは既存の`public.portfolio_settings`とし、設定画面も`getPortfolioSettings`だけを読む。

旧migrationとPhase 0調査資料は、履歴の欠損・部分適用を説明するlegacy evidenceとして保持する。`20250124_mypage_extension.sql`はSQL本文・filename・versionを変更せず、他の旧54件とともに`supabase/legacy-migrations/`へarchiveした。再生やhistory repairは行っていない。

| path | reference | classification | action | reason |
| ---- | --------- | -------------- | ------ | ------ |
| `src/lib/portfolio/queries.ts` | `getPortfolioProfile` / `.from("portfolio_profiles")` | `active_runtime_reference` | removed | 不在tableへの現行readを廃止し、`portfolio_settings`へ一本化 |
| `src/lib/portfolio/queries.ts` | `getPublicPortfolioBySlug` / `.from("portfolio_profiles")` | `active_runtime_reference` | removed | 呼出元がなく、承認済み廃止方針と競合 |
| `src/lib/portfolio/queries.ts` | `isSlugAvailable` / `.from("portfolio_profiles")` | `active_runtime_reference` | removed | 廃止したslug契約を現行APIとして残さない |
| `src/lib/portfolio/queries.ts` | `upsertPortfolioProfile` / `.from("portfolio_profiles")` | `active_runtime_reference` | removed | 不在tableへの将来用write helperを削除 |
| `src/app/[locale]/mypage/portfolio/PortfolioSettingsClient.tsx` | `getPortfolioProfile`と`PortfolioProfile` state | `active_runtime_reference` | replaced | `getPortfolioSettings`と`PortfolioSettings`へ置換 |
| `src/lib/portfolio/types.ts` | `PortfolioMode` / `PortfolioProfile` / `PublicPortfolioData` | `generated_type_reference` | removed | 廃止schemaだけを表す現行schema-bound型で、他のcallerなし |
| `src/app/api/account/delete/route.ts` | CASCADE対象としてのコメント | `documentation_reference` | removed | 実DBに存在しないtableを運用動作として説明していた |
| `supabase/legacy-migrations/20250124_mypage_extension.sql` | table/index/trigger/RLS/policy/comment | `legacy_migration_evidence` | archived byte-identically | recorded migrationの部分適用を示す一次証拠 |
| `docs/etorie-p0-01-20250124-investigation.md` | 原因調査と旧caller inventory | `documentation_reference` | preserved | 過去時点の調査記録 |
| `docs/etorie-p0-01-migration-baseline-ledger.md` | `20250124`の`partially_applied`判定 | `documentation_reference` | preserved | migration history台帳の証拠 |
| `docs/etorie-p0-01-version-normalization-plan.md` | 旧versionの扱い | `documentation_reference` | preserved | legacy history方針の証拠（語句の直接出現なし） |
| `docs/etorie-p0-01-baseline-spec.md` | current DB不在とbaseline除外 | `documentation_reference` | updated | 未決表現を承認済み廃止へ更新 |
| `docs/etorie-p0-01-history-strategy.md` | `20250124`の不在説明 | `documentation_reference` | preserved | hybrid採用理由の証拠 |
| `docs/etorie-p0-01-dry-run-runbook.md` | target処置の旧gate | `documentation_reference` | updated | Pattern B/Cの期待値を「不在」に固定 |
| `docs/etorie-p0-01-release-gate.md` | 旧blockerとsecurity gate | `documentation_reference` | updated | decision完了とartifact状態を反映 |

## 再検索条件

以下をrepository全体で検索し、active runtime、現行型、現行test/fixtureに参照が残らないことを静的checkの条件とする。

```text
portfolio_profiles
.from("portfolio_profiles")
.from('portfolio_profiles')
PortfolioProfile
PublicPortfolioData
```

意図して残るのは、旧migration、migration recovery/ledger、調査経緯、および本書を含むdocumentation evidenceだけである。
