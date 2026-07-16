import type { NatoriProjectStatus } from "@/features/natori/types/projects";

/**
 * 案件ステータス遷移の一元定義（タスク4）。
 *
 * これまで遷移ルールが4箇所（setNatoriProjectStatus の任意遷移 /
 * orderMailService の advanceFrom / webhook の無条件 rough /
 * deriveStatusFromTasks）に分散していたのを、この純関数に統一する。
 * 全ての DB 書き込み経路（projectsService / orderMailService / webhook）は
 * canTransitionNatoriStatus を通してから status を更新すること。
 *
 * モデル:
 * - 受注前（inquiry → estimating → quoted → awaiting_payment）: 前進のみ。
 *   逆行（例: quoted → inquiry）は弾く。
 * - 受注前 → 制作工程: 許可（タスクを進めると deriveStatusFromTasks が
 *   任意の制作ステータスを返すため、飛び越しを含めて許す）。
 * - 制作工程（rough〜completed）内: 双方向可（タスクのチェック / チェック解除で
 *   前後するのが正規の運用）。
 * - 制作工程 → 受注前: 逆行として弾く。
 * - closed（見送り）: 受注前からのみ入れる。出口は inquiry（再開）のみ。
 * - kind="payment-confirmed"（入金確認）: webhook と手動ボタンの競合を許容する
 *   明示ルール。受注前のどこからでも rough へ進める（メール送信後のステータス
 *   更新が失敗していても入金を取りこぼさない）。二重確定は payment_confirmed_at
 *   の条件付き UPDATE 側で防ぐ。
 */

export type NatoriStatusTransitionKind = "manual" | "payment-confirmed";

/** 受注前ステータス（canonical。consulting は inquiry 扱い） */
const PREWORK: readonly NatoriProjectStatus[] = [
  "inquiry",
  "estimating",
  "quoted",
  "awaiting_payment",
];

/** 制作工程ステータス（タスク操作で行き来する範囲） */
const WORK: readonly NatoriProjectStatus[] = [
  "rough",
  "lineart",
  "coloring",
  "waiting",
  "delivery_prep",
  "delivered",
  "completed",
];

function canonicalize(status: NatoriProjectStatus): NatoriProjectStatus {
  return status === "consulting" ? "inquiry" : status;
}

export function canTransitionNatoriStatus(
  fromRaw: NatoriProjectStatus,
  toRaw: NatoriProjectStatus,
  kind: NatoriStatusTransitionKind = "manual"
): boolean {
  const from = canonicalize(fromRaw);
  const to = canonicalize(toRaw);

  // 同一ステータスへの更新は no-op として常に許可（next_action の更新等）
  if (from === to) return true;

  if (kind === "payment-confirmed") {
    return PREWORK.includes(from) && to === "rough";
  }

  // 見送りからの出口は再開（inquiry）のみ
  if (from === "closed") return to === "inquiry";
  // 見送りに入れるのは受注前のみ（入金済みの制作中案件は close ではなく個別対応）
  if (to === "closed") return PREWORK.includes(from);

  const fromPre = PREWORK.indexOf(from);
  const toPre = PREWORK.indexOf(to);
  // 受注前 → 受注前: 前進のみ
  if (fromPre >= 0 && toPre >= 0) return toPre > fromPre;
  // 受注前 → 制作工程: 許可（タスク駆動の開始・飛び越し）
  if (fromPre >= 0 && WORK.includes(to)) return true;
  // 制作工程 → 制作工程: 双方向可
  if (WORK.includes(from) && WORK.includes(to)) return true;

  // 残り（制作工程 → 受注前 など）は全て弾く
  return false;
}

/** 不許可の遷移なら throw する版。バッチ・スクリプト等での明示チェック用 */
export function assertNatoriStatusTransition(
  from: NatoriProjectStatus,
  to: NatoriProjectStatus,
  kind: NatoriStatusTransitionKind = "manual"
): void {
  if (!canTransitionNatoriStatus(from, to, kind)) {
    throw new Error(`invalid natori status transition: ${from} -> ${to} (${kind})`);
  }
}
