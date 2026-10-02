"use client";
import type { useIntakeOperation } from "./useIntakeOperation";
import { portfolioFormColors as c } from "./PortfolioFormStyles";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import type { FrozenIntakeOperation } from "@/features/natori/data/intakeOperationClient";

function originalAnswerText(fields: FrozenIntakeOperation["fields"]): string {
  const lines = [`お名前：${fields.name ?? ""}`, `メールアドレス：${fields.email ?? ""}`];
  if (typeof fields.requestData === "string") {
    try {
      const decoded: unknown = JSON.parse(fields.requestData);
      const view = buildNatoriInquiryRequestView(decoded);
      if (view.kind === "structured") {
        for (const section of view.sections) {
          lines.push(`\n${section.title}`);
          for (const field of section.fields) lines.push(`${field.label}：${field.value}`);
        }
      } else lines.push("この画面で読み取れない項目は「元の保存情報」で全文を確認できます。");
    } catch { lines.push("この画面で読み取れない項目は「元の保存情報」で全文を確認できます。"); }
    if (typeof fields.referenceLinks === "string") {
      try {
        const links: unknown = JSON.parse(fields.referenceLinks);
        if (Array.isArray(links)) for (const link of links) {
          if (link && typeof link === "object" && "url" in link && typeof link.url === "string") {
            const label = "label" in link && typeof link.label === "string" ? link.label : "参考URL";
            lines.push(`${label}：${link.url}`);
          }
        }
      } catch { /* Full unchanged original is still available below. */ }
    }
  } else {
    const labels: Readonly<Record<string, string>> = { requestType: "依頼種別", plan: "サイズ・プラン", options: "追加オプション",
      budget: "予算", deadline: "希望納期", refUrls: "参考URL", details: "ご依頼の詳細", message: "その他・ご質問" };
    for (const [key, label] of Object.entries(labels)) {
      const value = fields[key];
      if (value !== undefined) lines.push(`${label}：${Array.isArray(value) ? value.join("\n") : value}`);
    }
  }
  return lines.join("\n");
}

export default function IntakeRecoveryPanel({ intake }: { intake: ReturnType<typeof useIntakeOperation> }) {
  const originals = intake.originalAnswers.map(draft => <section key={draft.operationId} className="mt-4 space-y-3 rounded-xl border-2 p-4 text-sm" style={{ borderColor: c.formBorder }}>
    <p>前回送信した入力をそのまま保管しています。フォームが変わっても、この内容をコピーして確認できます。</p>
    <label className="block font-bold">保存した入力内容
      <textarea readOnly value={originalAnswerText(draft.fields)} className="mt-2 min-h-40 w-full whitespace-pre-wrap break-all rounded-lg border px-3 py-2" />
    </label>
    <details>
      <summary className="cursor-pointer underline">元の保存情報をコピーする</summary>
      <p className="mt-2">表示できない項目も含め、保存した情報をそのままコピーできます。</p>
      <textarea aria-label="元の保存情報" readOnly value={JSON.stringify(draft.fields, null, 2)} className="mt-2 min-h-40 w-full whitespace-pre-wrap break-all rounded-lg border px-3 py-2" />
    </details>
    {draft.manifest.length > 0 && <p>参考画像は{draft.manifest.length}枚です。送信する場合は画像を選び直してください。</p>}
    <button type="button" disabled={intake.frozen || intake.busy} onClick={() => intake.confirmOriginalAnswers(draft.operationId)} className="pf-cute-focus min-h-11 underline">入力内容を確認しました</button>
  </section>);
  if (!intake.operation) return <>{intake.message && <p role="status" className="mt-3 whitespace-pre-wrap text-sm">{intake.message}</p>}{originals}</>;
  return <><section className="mt-4 space-y-3 rounded-xl border-2 p-4 text-sm" style={{ borderColor: c.formBorder }} aria-label="前回の受付結果の確認">
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
  </section>{originals}</>;
}
