"use client";
// サイトの外で決まった案件の「依頼」に、金額と入金をまとめて見せる。記録や修正は「金額・入金」で行う。
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { workspaceLook as look } from "../../constants/workspaceLook";
import { caseItemsTotal } from "../../lib/caseItems";
import type { NatoriCaseItem } from "../../types/caseItems";
import { caseTime } from "../../lib/caseWorkspacePresentation";

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export function ExternalCaseMoney({ amount, payment, items, onOpen }: {
  amount: number | null;
  /** 入金の記録（まだなら null）。古い記録には時刻がないことがある。 */
  payment: { at: string | null } | null;
  items: readonly Pick<NatoriCaseItem, "amount">[] | null;
  onOpen?: () => void;
}) {
  const total = items && items.length > 0 ? caseItemsTotal(items) : null;
  const differs = total !== null && amount !== null && total !== amount;
  return (
    <section className={`${look.panel} space-y-2`} aria-label="金額と入金">
      <h3 className={look.sectionTitle}>金額と入金</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-600">金額</dt>
        <dd>{amount === null ? (total !== null ? `まだ（品目の合計は${yen(total)}）` : "まだ決めていません") : yen(amount)}</dd>
        <dt className="text-zinc-600">入金</dt>
        <dd>{payment ? (payment.at ? `入金済み · ${caseTime(payment.at)}` : "入金済み") : "まだ記録していません"}</dd>
      </dl>
      {differs ? <p className="text-sm text-amber-900">品目の合計（{yen(total)}）と違います。</p> : null}
      {onOpen ? (
        <button type="button" className={ui.btnSecondary} onClick={onOpen}>
          {payment ? "金額・入金を開く" : amount === null || differs ? "金額を決める" : "入金を記録する"}
        </button>
      ) : null}
    </section>
  );
}
