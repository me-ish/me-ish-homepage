import "server-only";

// features/natori/server/publicIntakeRollout.ts
// 公開受付の structured writer (natori_create_project_with_tasks_v2) を
// 環境ごとに明示有効化するための rollout guard。
//
// 既存 repo の flag 慣習（NATORI_REQUIRE_AUTH / CERT_ONE_TIME と同じ
// 「未設定なら無効・"1" で明示的に有効」）に合わせる。default OFF なので、
// P1-06 を merge しても Production の受付挙動は現行のままになる。
// Preview で NATORI_PUBLIC_INTAKE_V2=1 を設定したときだけ新経路が動く。
//
// 有効化の前提（P1-13 release gate）:
// - P1-07 / P1-08 / P1-09 / P1-11
// - NATORI_OWNER_USER_ID が対象環境に設定されていること
// - Storage orphan 運用手順の確認

const ENABLED_VALUE = "1";

/** 公開フォームが structured RequestData V1 + create v2 RPC を使うか。 */
export function isPublicStructuredIntakeEnabled(): boolean {
  return process.env.NATORI_PUBLIC_INTAKE_V2?.trim() === ENABLED_VALUE;
}
