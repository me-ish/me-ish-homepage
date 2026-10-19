"use client";
import { natoriAdminUi } from "../../constants/adminUi";

export default function EditConflictReview({ initial, latest, current, labels, onCompare, onAcknowledge, reading }: {
  initial: object; latest: object | null; current: object; labels: Record<string, string>;
  onCompare: () => void; onAcknowledge: () => void; reading: boolean;
}) {
  const show = (value: unknown) => value === null || value === undefined || value === "" ? "（空欄）" : String(value);
  return <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3" role="region" aria-label="保存内容の比較">
    <p className="text-sm font-bold">入力内容を確認してください</p>
    <p className="text-xs">入力内容は保持しています。最新の保存済み内容を取得して比較し、確認後にもう一度保存してください。</p>
    <button type="button" className={natoriAdminUi.btnSecondary} onClick={onCompare} disabled={reading}>{reading ? "取得中…" : "最新の保存済み内容を取得して比較"}</button>
    {latest ? <><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>項目</th><th>編集開始時</th><th>現在の保存済み内容</th><th>入力中の内容</th></tr></thead><tbody>
      {Object.entries(labels).map(([key, label]) => <tr key={key}><th className="p-2 align-top">{label}</th>{[initial, latest, current].map((value, index) => <td key={index} className="max-w-xs whitespace-pre-wrap break-words p-2 align-top">{show((value as Record<string, unknown>)[key])}</td>)}</tr>)}
    </tbody></table></div><p className="text-xs">確認すると、変更した項目の入力を保持し、それ以外の項目は現在の保存済み内容に合わせます。まだ保存は行いません。</p>
    <button type="button" className={natoriAdminUi.btnSecondary} onClick={onAcknowledge} disabled={reading}>比較内容を確認し、最新の保存済み内容を基準にする</button></> : null}
  </div>;
}
