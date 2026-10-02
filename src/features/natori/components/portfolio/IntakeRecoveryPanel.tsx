"use client";
import type { useIntakeOperation } from "./useIntakeOperation";
import { portfolioFormColors as c } from "./PortfolioFormStyles";

export default function IntakeRecoveryPanel({ intake }: { intake: ReturnType<typeof useIntakeOperation> }) {
  if (!intake.operation) return intake.message ? <p role="status" className="mt-3 whitespace-pre-wrap text-sm">{intake.message}</p> : null;
  return <section className="mt-4 space-y-3 rounded-xl border-2 p-4 text-sm" style={{ borderColor: c.formBorder }} aria-label="前回の受付結果の確認">
    <p role="status" className="font-bold">{intake.message}</p>
    <p>受付済みの場合は同じ受付結果を表示します。未保存を確認できるまで、入力内容を変えて応募し直す必要はありません。</p>
    {intake.operation.manifest.length > 0 && <div>
      <label className="block font-bold">再試行用の画像を選択
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple disabled={intake.busy} className="mt-2 block w-full"
          onChange={event => { intake.selectFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      </label>
      <p>再読込後は前回と同じ画像を同じ順番で選択してください。受付済みなら再選択は不要です。</p>
      {intake.selectedNames.length > 0 && <p>{intake.selectedNames.join("、")}</p>}
      <button type="button" onClick={() => intake.selectFiles([])} disabled={intake.busy} className="pf-cute-focus min-h-11 underline">再選択を取り消す</button>
    </div>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={intake.busy} onClick={() => void intake.check()} className="pf-cute-focus min-h-11 rounded-full border px-4">受付結果を確認する</button>
      <button type="button" disabled={intake.busy} onClick={() => void intake.retry()} className="pf-cute-focus min-h-11 rounded-full border px-4">同じ内容で再試行する</button>
      <button type="button" disabled={intake.busy} onClick={() => void intake.settle()} className="pf-cute-focus min-h-11 underline">未保存を確認して編集に戻る</button>
    </div>
  </section>;
}
