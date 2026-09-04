import "server-only";

// features/natori/server/publicIntakeOwner.ts
// 公開受付（ご依頼フォーム）専用の owner 解決。
//
// natoriOwner.ts の resolveNatoriActingUserId は「管理画面から書き込む人」を
// 解決するため session-first で、さらに単一 owner の探索 fallback を持つ。
// 公開 route でそれを使うと、無関係にログインしている閲覧者の session が
// 依頼案件の owner になり得る。したがって公開受付では責務を分離し、
// 明示設定された trusted owner だけを使う。
//
// ここでは以下を行わない:
// - session / cookie の参照
// - 既存 DB から owner を探索する fallback
// - 解決結果（UUID 実値）の log 出力

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export type PublicIntakeOwnerResult =
  | { kind: "ok"; ownerId: string }
  /** NATORI_OWNER_USER_ID 未設定。503 相当の設定エラーとして安全に失敗する。 */
  | { kind: "unconfigured" }
  /** 設定値が UUID として不正。DB へ問い合わせず設定エラーとして失敗する。 */
  | { kind: "invalid" };

/**
 * 公開受付の owner を解決する。
 * 値が auth.users に実在するかどうかは natori_create_project_with_tasks_v2 が
 * 最終確認するため、ここでは形式検証だけを行う。
 */
export function resolvePublicIntakeOwnerId(): PublicIntakeOwnerResult {
  const configured = process.env.NATORI_OWNER_USER_ID?.trim() ?? "";
  if (configured.length === 0) {
    console.error("[natori-public-intake] owner not configured");
    return { kind: "unconfigured" };
  }
  const normalized = configured.toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    console.error("[natori-public-intake] owner value is not a uuid");
    return { kind: "invalid" };
  }
  return { kind: "ok", ownerId: normalized };
}
