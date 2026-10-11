# PR #162 隔離受入の記録

対象は引き継ぎHEAD 49e3a5bと、このPRに追加した間接view検出・privacy header修正。実行環境は2026年10月12日のdot側executor。架空データだけを使用した。

- api-acceptance-results.json: 実GoTrue/Auth→PostgREST→pg_graphqlの結果。口座read/saveは既存のserver-only fixtureによる制約を記録。
- http-acceptance-results.json: 実Next devの発行API、証明書HTML/RSC、privacy、無効リンクの結果。
- certificate-acceptance.txt: 実SDK/DB/viewの11件の成功記録。
- certificate-view-executed.txt: 実際に実行したviewのSQLとsecurity_invoker設定。元定義はsupabase/schema.sql。

これらは本番設定のdumpではない。詳細・限界は[DB-01記録](../../natori/Natori_Audit_DB01_Read_Lockdown.md)を参照。専用CIで間接view拒否・invoker chainの回帰を再実行できる。実Auth/HTTPのハーネスは当executorの/workspace/audit-handoff内で実行し、製品依存・CI設定へ新サービスを追加していない。JWT、秘密値、実顧客情報、HTTP本文はこの記録へ含めない。
