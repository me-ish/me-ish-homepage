"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import EstimateJourney from "../dashboard/EstimateJourney";
import { useCaseDraft } from "./useCaseDraft";
import { useCaseAdminOperation } from "./useCaseAdminOperation";
import { loadCaseAdministration } from "../../data/supabaseCaseAdministration";
import {
  caseAdminLabels,
  caseBasicDetails,
  caseProject,
  type CaseAdminView,
  type CaseAdminRequest,
} from "../../lib/caseAdministration";
import { caseTime } from "../../lib/caseWorkspacePresentation";
import { notificationPurposeName } from "../../lib/notificationLabels";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import { workspaceLook as look } from "../../constants/workspaceLook";
import type { CaseOverviewPart, CaseSection } from "../../types/caseWorkspace";
const DETAIL_LABELS = { title: "案件名", client_name: "お客さんの名前", amount: "金額", delivery_plan: "納期のプラン", start_date: "作業を始める日", due_date: "納期", note: "依頼文" } as const;
const card = `space-y-3 ${look.cardPadded}`;
type Operation = ReturnType<typeof useCaseAdminOperation>;
export function CaseAdminConfirmation({ operation }: { operation: Operation }) {
  const o = operation;
  return (
    <>
      {!o.ready ? <p role="status">読み込み中…</p> : null}
      {o.blocked ? (
        <p role="alert">
          前の操作の記録を読み込めませんでした。ページを読み込み直してください。
        </p>
      ) : null}
      {o.saved ? (
        <section
          aria-label="保存する前の確認"
          className={look.confirm}
        >
          <h3 className="font-semibold">
            {caseAdminLabels[o.saved.request.action.command]}
          </h3>
          {o.saved.summary.map((s, i) => (
            <p key={i} className="whitespace-pre-wrap break-words text-sm">
              {s}
            </p>
          ))}
          {!o.done ? (
            <>
              <button
                className={ui.btnPrimary}
                disabled={o.busy}
                onClick={() => void o.execute()}
              >
                {o.saved.started
                  ? "もう一度試す"
                  : "この内容で保存する"}
              </button>
              {o.saved.started ? (
                <p className="text-sm">
                  前の操作が届いているかもしれません。もう一度試しても、二重には保存されません。
                </p>
              ) : null}
            </>
          ) : null}
          <button
            className={ui.btnSecondary}
            disabled={o.busy}
            onClick={() => void o.lookup()}
          >
            結果を見る
          </button>
          <button
            className={ui.btnSecondary}
              disabled={o.blocked || o.busy || (o.saved.started && !o.done)}
            onClick={o.close}
          >
            {o.done ? "閉じる" : "やめる"}
          </button>
        </section>
      ) : null}
      {o.message ? (
        <p role="status" className="text-sm">
          {o.message}
        </p>
      ) : null}
    </>
  );
}
export function CaseAdministrationPanel({
  projectId,
  section,
  overviewPart = null,
  onChanged,
  onDraftChange,
  refreshKey,
  selectedNotificationId,
  externalOrder = false,
}: {
  /** Taken outside the site (つなぐ etc.): the amount is entered here and the quote mail form stays folded. */
  externalOrder?: boolean;
  selectedNotificationId?:string;
  refreshKey: string;
  projectId: string;
  section: CaseSection;
  overviewPart?: CaseOverviewPart | null;
  onChanged: () => void;
  onDraftChange: (v: boolean) => void;
}) {
  const [view, setView] = useState<CaseAdminView | null>(null),
    [error, setError] = useState(""),
    [formDirty, setFormDirty] = useState(false),
    [opDirty, setOpDirty] = useState(false),
    [quoteDirty, setQuoteDirty] = useState(false),
    [amountDirty, setAmountDirty] = useState(false),
    [lifecycleDirty, setLifecycleDirty] = useState(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const v = await loadCaseAdministration(projectId,undefined,selectedNotificationId);
      if (current !== generation.current) return;
      setView(v.view);
      setError(v.view ? "" : "案件が見つかりません。");
    } catch (e) {
      if (current !== generation.current) return;
      setView(null);
      setError(e instanceof Error ? e.message : "読み込めませんでした。");
    }
  }, [projectId,selectedNotificationId]);
  useEffect(() => {
    void refresh();
    return invalidate;
  }, [refresh, refreshKey, invalidate]);
  const changed = () => {
    void refresh();
    onChanged();
  };
  const operation = useCaseAdminOperation(
    `natori-case-admin/${projectId}`,
    changed,
    setOpDirty,
  );
  useEffect(() => {
    onDraftChange(formDirty || opDirty || quoteDirty || lifecycleDirty || amountDirty);
    return () => onDraftChange(false);
  }, [formDirty, opDirty, quoteDirty, lifecycleDirty, amountDirty, onDraftChange]);
  if (!view || (selectedNotificationId ? view.selectedNotice?.id!==selectedNotificationId : !!view.selectedNotice))
    return (
      <section className={card}>
        <p role={error ? "alert" : "status"}>{error || "読み込み中…"}</p>
        <button className={ui.btnSecondary} onClick={() => void refresh()}>
          再読み込み
        </button>
      </section>
    );
  const p = view.project,
    paymentRecorded = Boolean(
      p.paymentConfirmedAt || p.paidAt || p.paidAmount !== null,
    ),
    disabled =
      !operation.ready ||
      operation.busy ||
      !!operation.saved ||
      operation.blocked,
    inactive = !!p.deletedAt || p.status === "closed";
  const prepare = (action: CaseAdminRequest["action"], summary: string[]) =>
    operation.prepare(
      {
        operationId: crypto.randomUUID(),
        projectId,
        revision: view.revision,
        action,
      },
      [`${p.title} / ${p.clientName}さん`, ...summary],
    );
  return (
    <div className="mt-4 space-y-4" role="region" aria-label="案件の設定">
      <CaseAdminConfirmation operation={operation} />
      <div hidden={section !== "overview"} className="space-y-4">
        <section hidden={overviewPart !== "details"} className={card}>
          <h3 className="font-semibold">案件の情報</h3>
          <BasicDetails
            key={projectId}
            view={view}
            disabled={disabled || inactive}
            onDirty={setFormDirty}
            prepare={(patch) =>
              prepare({ command: "details", patch }, [
                ...Object.entries(patch).map(([key, value]) => `${DETAIL_LABELS[key as keyof typeof DETAIL_LABELS] ?? key}：${value ?? "空欄"}`),
                "OKをもらった見積の内容は変わりません。",
              ])
            }
          />
        </section>
        <section hidden={overviewPart !== "lifecycle"} className={card}>
          <h3 className="font-semibold">見送る・しまう</h3>
          <Lifecycle
            view={view}
            disabled={disabled}
            prepare={prepare}
            onDirty={setLifecycleDirty}
          />
        </section>
      </div>
      <div hidden={section !== "transaction"} className="space-y-4">
        <section className={card}>
          <h3 className="font-semibold">{externalOrder ? "金額と入金" : "振込などの入金を記録"}</h3>
          {externalOrder && !paymentRecorded ? (
            <ExternalAmount
              key={`${projectId}/${view.revision}`}
              view={view}
              disabled={disabled || inactive}
              onDirty={setAmountDirty}
              prepare={(patch) =>
                prepare({ command: "details", patch }, [
                  `金額：${patch.amount === null ? "空欄" : `${patch.amount.toLocaleString("ja-JP")}円`}`,
                ])
              }
            />
          ) : null}
          <p className={externalOrder ? "text-sm" : undefined}>
            {externalOrder && !paymentRecorded ? "" : `金額：${p.amount === null ? "まだ決まっていません" : `${p.amount.toLocaleString("ja-JP")}円`} / `}
            {paymentRecorded
              ? `入金済み ${caseTime(p.paymentConfirmedAt ?? p.paidAt ?? "")}`
              : "入金はまだ"}
          </p>
          {externalOrder ? null : (
            <p className="text-sm">
              カード決済ではなく、振込や外部サイト（つなぐ等）で受け取った時に使います。
            </p>
          )}
          {!paymentRecorded && (p.amount === null || p.type === "undecided") ? (
            <p className="text-sm text-amber-900">
              記録する前に{[p.amount === null ? (externalOrder ? "金額（上の欄）" : "金額（その他 → 案件の情報を直す）") : "", p.type === "undecided" ? "依頼の種類（制作）" : ""].filter(Boolean).join("と")}を決めてください。
            </p>
          ) : null}
          <button
            className={ui.btnSecondary}
            disabled={disabled || inactive || paymentRecorded || p.amount === null || p.type === "undecided"}
            onClick={() =>
              prepare({ command: "manual-payment" }, [
                `金額：${p.amount === null ? "まだ決まっていません" : `${p.amount.toLocaleString("ja-JP")}円`}`,
                `見積：${view.quote ? `第${view.quote.version}版 / ${view.quote.amount.toLocaleString("ja-JP")}円 / ${view.quote.acceptedAt ? "OKをもらった" : "OKはまだ"}` : "なし"}`,
                "いまの時刻で入金を記録して、制作（ラフ）に進みます。",
              ])
            }
          >
            入金を記録する（前に内容を表示）
          </button>
        </section>
        <QuoteMailSection folded={externalOrder && !view.quote}>
          <EstimateJourney
            key={projectId}
            project={{
              ...caseProject(p),
              quoteAcceptedAt: view.quote?.acceptedAt ?? view.acceptance.at,
            }}
            portfolioContent={null}
            workspace={{
              revision: view.revision,
              onChanged: changed,
              onDirty: setQuoteDirty,
              locked:
                inactive ||
                !!view.quote?.acceptedAt ||
                !!view.acceptance.at ||
                paymentRecorded,
              quoteNotice: view.quote,
            }}
          />
        </QuoteMailSection>
        <section className={card}>
          <h3 className="font-semibold">送ったメール</h3>
          {view.selectedNotice?<p role="status">選んだメールだけを表示しています。{view.selectedNotice.isLatest?"":"これより新しいメールがあるので、ここからは送り直せません。"}</p>:null}
          {!view.complete&&!view.selectedNotice ? (
            <p role="status">
              メールが多いので、終わっていないものから200件だけ表示しています。
            </p>
          ) : null}
          {view.notices.length ? (
            view.notices.map((n) => (
              <article key={n.id} className="space-y-2 border-t pt-3 text-sm">
                <p>
                  {notificationPurposeName(n.purpose)} · {n.attempt_no}回目 ·{" "}
                  {n.status === "sent"
                    ? "送信しました"
                    : n.status === "failed"
                      ? "送れませんでした"
                      : n.status === "pending"
                        ? "送信待ち"
                        : "送れたか分かりません"}
                </p>
                {n.deadline ? <p>期限：{caseTime(n.deadline)}</p> : null}
                {n.retry_candidate ? (
                  <button
                    className={ui.btnSecondary}
                    disabled={disabled || !!p.deletedAt || !n.preview}
                    onClick={() =>
                      prepare(
                        {
                          command: "retry-notice",
                          notificationId: n.id,
                          previewHash: n.preview!.hash,
                        },
                        [
                          `${notificationPurposeName(n.purpose)}（${n.attempt_no}回目）`,
                          n.deadline ? `期限：${caseTime(n.deadline)}` : "",
                          `宛先：${n.preview?.to.join(", ")} / 送り主：${n.preview?.from} / 返信先：${n.preview?.replyTo ?? "なし"} / BCC：${n.preview?.bcc?.join(", ") ?? "なし"}`,
                          `件名：${n.preview?.subject}\n${n.preview?.body}`,
                          "前と同じ宛先と本文で送り直します。",
                        ],
                      )
                    }
                  >
                    このメールを送り直す（前に内容を表示）
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p>まだメールは送っていません</p>
          )}
        </section>
      </div>
    </div>
  );
}
/**
 * The quote form mails the client. Orders taken outside the site rarely need it,
 * so for them it starts folded. Saving a draft keeps the external steps; sending switches to the site's steps.
 */
function QuoteMailSection({ folded, children }: { folded: boolean; children: ReactNode }) {
  if (!folded)
    return (
      <section className={card}>
        <h3 className="font-semibold">見積</h3>
        {children}
      </section>
    );
  return (
    <details className={look.cardPadded}>
      <summary className="cursor-pointer font-semibold">見積をメールで送る</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-zinc-600">
          サイトの外で決まった案件では使いません。見積を送ると、サイトの流れ（見積→支払い）に切り替わります。
        </p>
        {children}
      </div>
    </details>
  );
}
/** Amount for an order taken outside the site. Saved with the same command as 案件の情報を直す. */
function ExternalAmount({
  view,
  disabled,
  prepare,
  onDirty,
}: {
  view: CaseAdminView;
  disabled: boolean;
  prepare: (patch: ReturnType<typeof caseBasicDetails.parse>) => void;
  onDirty: (v: boolean) => void;
}) {
  const p = view.project;
  const saved = p.amount === null ? "" : String(p.amount);
  const [amount, setAmount] = useState(saved);
  const [error, setError] = useState("");
  useEffect(() => {
    onDirty(amount !== saved);
    return () => onDirty(false);
  }, [amount, saved, onDirty]);
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const patch = caseBasicDetails.parse({
            title: p.title,
            client_name: p.clientName,
            amount: amount === "" ? null : Number(amount),
            delivery_plan: p.deliveryPlan,
            start_date: p.startDate ?? null,
            due_date: p.dueDate ?? null,
            note: p.note ?? null,
          });
          setError("");
          prepare(patch);
        } catch {
          setError("金額は0以上の整数（円）で入れてください。");
        }
      }}
    >
      <fieldset disabled={disabled} className="flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          金額（円）
          <input
            className={ui.input}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <button className={ui.btnSecondary} disabled={amount === saved}>
          金額を保存
        </button>
      </fieldset>
      {error ? <p role="alert" className="text-sm">{error}</p> : null}
    </form>
  );
}
function BasicDetails({
  view,
  disabled,
  prepare,
  onDirty,
}: {
  view: CaseAdminView;
  disabled: boolean;
  prepare: (patch: ReturnType<typeof caseBasicDetails.parse>) => void;
  onDirty: (v: boolean) => void;
}) {
  const p = view.project;
  const [form, setForm, reset] = useCaseDraft(
    `natori-case-draft/${p.id}/basic`,
    {
      title: p.title,
      client_name: p.clientName,
      amount: p.amount === null ? "" : String(p.amount),
      delivery_plan: p.deliveryPlan,
      start_date: p.startDate ?? "",
      due_date: p.dueDate ?? "",
      note: p.note ?? "",
      revision: view.revision,
    },
    onDirty,
  );
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (form.revision !== view.revision)
            throw Error(
              "ほかの画面で案件が変わりました。「最新の内容に戻す」を押してください。",
            );
          const { revision: _revision, ...fields } = form;
          const patch = caseBasicDetails.parse({
            ...fields,
            amount: form.amount === "" ? null : Number(form.amount),
            start_date: form.start_date || null,
            due_date: form.due_date || null,
            note: form.note || null,
          });
          setError("");
          prepare(patch);
        } catch (e) {
          setError(e instanceof Error ? e.message : "入力に足りないところがあります。");
        }
      }}
    >
      <fieldset disabled={disabled} className="space-y-3">
        {(
          [
            ["title", "案件名"],
            ["client_name", "お客さんの名前"],
            ["amount", "金額（円・決まっていなければ空欄）"],
            ["start_date", "作業を始める日"],
            ["due_date", "納期"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            {label}
            <input
              className={ui.input}
              type={
                key.endsWith("date")
                  ? "date"
                  : key === "amount"
                    ? "number"
                    : "text"
              }
              value={form[key]}
              onChange={(e) =>
                setForm((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </label>
        ))}
        <label className="block text-sm">
          納期プラン
          <select
            className={ui.input}
            value={form.delivery_plan}
            onChange={(e) =>
              setForm((v) => ({ ...v, delivery_plan: e.target.value }))
            }
          >
            <option value="normal">通常</option>
            <option value="rush_14_days">14日</option>
            <option value="rush_7_days">7日</option>
          </select>
        </label>
        <label className="block text-sm">
          依頼文
          <textarea
            className={ui.input}
            value={form.note}
            onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))}
          />
        </label>
        <button className={ui.btnSecondary}>保存する（前に内容を表示）</button>
        <button
          type="button"
          className={ui.btnSecondary}
          onClick={() =>
            reset({
              title: p.title,
              client_name: p.clientName,
              amount: p.amount === null ? "" : String(p.amount),
              delivery_plan: p.deliveryPlan,
              start_date: p.startDate ?? "",
              due_date: p.dueDate ?? "",
              note: p.note ?? "",
              revision: view.revision,
            })
          }
        >
          最新の内容に戻す
        </button>
      </fieldset>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
function Lifecycle({
  view,
  disabled,
  prepare,
  onDirty,
}: {
  view: CaseAdminView;
  disabled: boolean;
  onDirty: (v: boolean) => void;
  prepare: (action: CaseAdminRequest["action"], summary: string[]) => void;
}) {
  const p = view.project;
  const [draft, setDraft] = useCaseDraft(
    `natori-case-draft/${p.id}/close`,
    { reason: "" },
    onDirty,
  );
  const reason = draft.reason;
  return (
    <>
      {p.deletedAt ? (
        <button
          className={ui.btnSecondary}
          disabled={disabled}
          onClick={() =>
            prepare({ command: "restore" }, [
              "しまった案件を一覧に戻します。",
            ])
          }
        >
          一覧に戻す（前に内容を表示）
        </button>
      ) : p.status === "closed" ? (
        <button
          className={ui.btnSecondary}
          disabled={disabled}
          onClick={() =>
            prepare({ command: "reopen" }, [
              "見送った相談を、相談中に戻します。前の支払いリンクは使えないままです。",
            ])
          }
        >
          相談を再開する（前に内容を表示）
        </button>
      ) : [
          "inquiry",
          "consulting",
          "estimating",
          "quoted",
          "awaiting_payment",
        ].includes(p.status) ? (
        <>
          <label className="block text-sm">
            見送りの理由
            <input
              className={ui.input}
              value={reason}
              onChange={(e) => setDraft({ reason: e.target.value })}
              maxLength={2000}
            />
          </label>
          <button
            className={ui.btnSecondary}
            disabled={disabled || !reason.trim()}
            onClick={() =>
              prepare({ command: "close", reason: reason.trim() }, [
                `理由：${reason}`,
                "この相談を見送ります。送ってある支払いリンクは、これだけでは止まりません。",
              ])
            }
          >
            見送る（前に内容を表示）
          </button>
        </>
      ) : null}
      {!p.deletedAt && ["closed", "completed"].includes(p.status) ? (
        <button
          className={ui.btnSecondary}
          disabled={disabled}
          onClick={() =>
            prepare({ command: "archive" }, [
              "記録とファイルは残したまま、一覧から外します。",
            ])
          }
        >
          しまう（前に内容を表示）
        </button>
      ) : null}
    </>
  );
}
