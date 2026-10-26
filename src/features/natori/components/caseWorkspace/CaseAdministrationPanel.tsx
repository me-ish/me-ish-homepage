"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
import type { CaseSection } from "../../types/caseWorkspace";
const card = "space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5";
type Operation = ReturnType<typeof useCaseAdminOperation>;
export function CaseAdminConfirmation({ operation }: { operation: Operation }) {
  const o = operation;
  return (
    <>
      {!o.ready ? <p role="status">保存した操作を確認中…</p> : null}
      {o.blocked ? (
        <p role="alert">
          保存した操作情報を確認できません。新しい操作は行わず担当者に確認してください。
        </p>
      ) : null}
      {o.saved ? (
        <section
          aria-label="案件操作の確認"
          className="space-y-3 rounded-xl border-2 border-pink-200 bg-pink-50 p-4"
        >
          <h3 className="font-semibold">
            {caseAdminLabels[o.saved.request.action.command]}の確認
          </h3>
          {o.saved.summary.map((s, i) => (
            <p key={i} className="whitespace-pre-wrap break-words text-sm">
              {s}
            </p>
          ))}
          <p className="text-xs break-all">
            操作ID：{o.saved.request.operationId}
          </p>
          {!o.done ? (
            <>
              <button
                className={ui.btnPrimary}
                disabled={o.busy}
                onClick={() => void o.execute()}
              >
                {o.saved.started
                  ? "同じ操作IDの保存を確認・再試行"
                  : "確認した内容で実行"}
              </button>
              {o.saved.started ? (
                <p className="text-sm">
                  前の要求が保存された可能性があります。新しい操作は作らず、同じIDだけで確認します。通知が保存済みなら再送しません。
                </p>
              ) : null}
            </>
          ) : null}
          <button
            className={ui.btnSecondary}
            disabled={o.busy}
            onClick={() => void o.lookup()}
          >
            同じ操作の結果を照会
          </button>
          <button
            className={ui.btnSecondary}
              disabled={o.blocked || o.busy || (o.saved.started && !o.done)}
            onClick={o.close}
          >
            {o.done ? "確認済みの操作を閉じる" : "実行前の確認を取り消す"}
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
  onChanged,
  onDraftChange,
  refreshKey,
  selectedNotificationId,
}: {
  selectedNotificationId?:string;
  refreshKey: string;
  projectId: string;
  section: CaseSection;
  onChanged: () => void;
  onDraftChange: (v: boolean) => void;
}) {
  const [view, setView] = useState<CaseAdminView | null>(null),
    [error, setError] = useState(""),
    [formDirty, setFormDirty] = useState(false),
    [opDirty, setOpDirty] = useState(false),
    [quoteDirty, setQuoteDirty] = useState(false),
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
      setError(v.view ? "" : "案件を確認できません。");
    } catch (e) {
      if (current !== generation.current) return;
      setView(null);
      setError(e instanceof Error ? e.message : "取得できません。");
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
    onDraftChange(formDirty || opDirty || quoteDirty || lifecycleDirty);
    return () => onDraftChange(false);
  }, [formDirty, opDirty, quoteDirty, lifecycleDirty, onDraftChange]);
  if (!view || (selectedNotificationId ? view.selectedNotice?.id!==selectedNotificationId : !!view.selectedNotice))
    return (
      <section className={card}>
        <p role={error ? "alert" : "status"}>{error || "管理操作を確認中…"}</p>
        <button className={ui.btnSecondary} onClick={() => void refresh()}>
          管理操作を再取得
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
      [`対象：${p.title} / ${p.clientName}`, ...summary],
    );
  return (
    <div className="mt-4 space-y-4" role="region" aria-label="既存操作の統合">
      <CaseAdminConfirmation operation={operation} />
      <div hidden={section !== "overview"} className="space-y-4">
        <section className={card}>
          <h3 className="font-semibold">案件の基本情報</h3>
          <BasicDetails
            key={projectId}
            view={view}
            disabled={disabled || inactive}
            onDirty={setFormDirty}
            prepare={(patch) =>
              prepare({ command: "details", patch }, [
                `保存する基本情報：${JSON.stringify(patch, null, 2)}`,
                "登録日付・管理額の補正です。承諾済みの見積条件は変更しません。",
              ])
            }
          />
        </section>
        <section className={card}>
          <h3 className="font-semibold">見送り・再開・保管</h3>
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
          <h3 className="font-semibold">銀行振込等の入金を手動で記録</h3>
          <p>
            現在の管理額：{p.amount === null ? "未確定" : `${p.amount} JPY`} /{" "}
            {paymentRecorded
              ? `入金記録あり ${caseTime(p.paymentConfirmedAt ?? p.paidAt ?? "")}`
              : "入金記録なし"}
          </p>
          <p className="text-sm">
            実際に別途確認した入金だけを記録します。Stripeの結果不明や未停止リンクは、取引内の照合で先に確認してください。
          </p>
          <button
            className={ui.btnSecondary}
            disabled={disabled || inactive || paymentRecorded}
            onClick={() =>
              prepare({ command: "manual-payment" }, [
                `記録する額：${p.amount ?? "未確定"} JPY`,
                `対象見積：${view.quote ? `第${view.quote.version}版 ${view.quote.id} / ${view.quote.amount} JPY / ${view.quote.acceptedAt ? "承諾記録あり" : "承諾記録なし"}` : "内部見積なし"}`,
                "銀行振込等を担当が確認した記録です。Stripeの成功・見積承諾は生成しません。現在の確認時刻で保存し、既存ルールでラフ工程へ進みます。",
              ])
            }
          >
            手動入金の確認へ
          </button>
        </section>
        <section className={card}>
          <h3 className="font-semibold">この案件の正式見積</h3>
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
        </section>
        <section className={card}>
          <h3 className="font-semibold">通知の状態と復旧</h3>
          <p className="text-sm">
            送信サービス受付は到達・既読・入金・受取とは別です。結果不明は上の照合で確認し、再送では回避しません。
          </p>
          {view.selectedNotice?<p role="status">選択した通知1件だけを確認しています。別の系列・用途は取得済みや解決済みと扱いません。{view.selectedNotice.isLatest?"この系列の最新試行です。":"過去の試行です。この記録から復旧しません。"}</p>:null}
          {!view.complete&&!view.selectedNotice ? (
            <p role="status">
              未完了を優先した最大200通知系列を表示しています。他の系列と過去の試行はこの一覧では未取得です。基本情報や入金の確認は案件全体の最新記録を使います。
            </p>
          ) : null}
          {view.notices.length ? (
            view.notices.map((n) => (
              <article key={n.id} className="space-y-2 border-t pt-3 text-sm">
                <p>
                  {notificationPurposeName(n.purpose)} · 試行{n.attempt_no} ·{" "}
                  {n.status === "sent"
                    ? "送信サービス受付済み"
                    : n.status === "failed"
                      ? "確定失敗の記録"
                      : n.status === "pending"
                        ? "送信待ちの記録"
                        : "結果不明・要確認"}
                </p>
                <p>
                  対象見積：{n.quote_id ?? "別用途"} / 条件期限：
                  {n.deadline ?? "この一覧では未確認"}
                </p>
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
                          `通知：${n.id} / ${notificationPurposeName(n.purpose)} / 試行${n.attempt_no}`,
                          `対象見積：${n.quote_id ?? "別用途"} / 条件期限：${n.deadline ?? "用途別に再確認"}`,
                          `宛先：${n.preview?.to.join(", ")} / From：${n.preview?.from} / Reply-To：${n.preview?.replyTo ?? "なし"} / BCC：${n.preview?.bcc?.join(", ") ?? "なし"}`,
                          `件名：${n.preview?.subject}\n${n.preview?.body}`,
                          "保存済みの宛先・本文・同じ通知系列だけを復旧します。版の発行、入金や受取の変更は行いません。",
                        ],
                      )
                    }
                  >
                    この通知の復旧内容を確認
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <p>通知記録なし（取得済み）</p>
          )}
        </section>
      </div>
    </div>
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
              "取得後に案件が更新されました。入力を控え、最新版をフォームへ戻して確認してください。",
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
          setError(e instanceof Error ? e.message : "入力を確認してください。");
        }
      }}
    >
      <fieldset disabled={disabled} className="space-y-3">
        {(
          [
            ["title", "案件名"],
            ["client_name", "依頼者名"],
            ["amount", "管理額（円・空欄は未確定）"],
            ["start_date", "登録着手日"],
            ["due_date", "登録納期"],
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
          担当メモ
          <textarea
            className={ui.input}
            value={form.note}
            onChange={(e) => setForm((v) => ({ ...v, note: e.target.value }))}
          />
        </label>
        <button className={ui.btnSecondary}>基本情報の確認へ</button>
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
          最新版を基本情報へ戻す
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
              "保管だけを解除します。見送り状態・入金・受取・停止済みリンクは変えません。",
            ])
          }
        >
          保管から復元の確認へ
        </button>
      ) : p.status === "closed" ? (
        <button
          className={ui.btnSecondary}
          disabled={disabled}
          onClick={() =>
            prepare({ command: "reopen" }, [
              "見送りから相談受付へ戻します。古い支払リンクや送信を再開しません。",
            ])
          }
        >
          相談再開の確認へ
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
                "相談を見送りとして記録します。リンク停止完了は別に確認し、未解決は保持します。",
              ])
            }
          >
            見送りの確認へ
          </button>
        </>
      ) : null}
      {!p.deletedAt && ["closed", "completed"].includes(p.status) ? (
        <button
          className={ui.btnSecondary}
          disabled={disabled}
          onClick={() =>
            prepare({ command: "archive" }, [
              "履歴とファイルを残して保管します。未停止リンクや未解決処理があれば実行しません。",
            ])
          }
        >
          保管の確認へ
        </button>
      ) : null}
    </>
  );
}
