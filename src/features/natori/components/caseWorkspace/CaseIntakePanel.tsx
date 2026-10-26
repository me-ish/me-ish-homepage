"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadCaseContext } from "../../data/supabaseCaseScreen";
import type { CaseContext } from "../../lib/caseScreenContext";
import type { CaseAdminRequest } from "../../lib/caseAdministration";
import { buildNatoriInquiryRequestView } from "../../lib/inquiryRequestView";
import { parseInquiryNote } from "../../lib/inquiryNoteView";
import InquiryRequestSummary from "../dashboard/inquiry/InquiryRequestSummary";
import InquiryReferenceFiles from "../dashboard/inquiry/InquiryReferenceFiles";
import { useCaseAdminOperation } from "./useCaseAdminOperation";
import { CaseAdminConfirmation } from "./CaseAdministrationPanel";
import { useCaseDraft } from "./useCaseDraft";
import { natoriAdminUi as ui } from "../../constants/adminUi";
import type { CaseSection } from "../../types/caseWorkspace";
import { normalizeNatoriReferenceUrl } from "../../lib/referenceLinks";
import { CaseWorkspaceLoadError } from "../../types/caseWorkspaceLoad";
export function CaseIntakePanel({
  projectId,
  section,
  readOnly = false,
  refreshKey,
  onChanged,
  onDraftChange,
  onAccessRejected,
}: {
  projectId: string;
  section: CaseSection;
  readOnly?: boolean;
  refreshKey: string;
  onChanged: () => void;
  onDraftChange: (v: boolean) => void;
  onAccessRejected: () => void;
}) {
  const [view, setView] = useState<CaseContext | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  const [formDirty, setFormDirty] = useState(false),
    [opDirty, setOpDirty] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef<{
    generation: number;
    promise: Promise<CaseContext>;
    superseded: Promise<void>;
    supersede: () => void;
  } | null>(null);
  const invalidate = useCallback(() => {
      generation.current++;
      inFlight.current?.supersede();
    }, []),
    rejectRef = useRef(onAccessRejected);
  rejectRef.current = onAccessRejected;
  const startRead = useCallback(() => {
    inFlight.current?.supersede();
    setLoading(true);
    const current = ++generation.current;
    let supersede!: () => void;
    const superseded = new Promise<void>((resolve) => { supersede = resolve; });
    const promise = loadCaseContext(projectId)
      .then((v) => {
        if (current === generation.current) {
          setView(v);
          setError("");
        }
        return v;
      })
      .catch((e) => {
        if (current === generation.current) {
          setView(null);
          if (e instanceof CaseWorkspaceLoadError && e.kind === "unauthorized")
            rejectRef.current();
          setError(
            "依頼内容・資料を取得できません。未提出とは断定せず再取得してください。",
          );
        }
        throw e;
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
    const read = { generation: current, promise, superseded, supersede };
    inFlight.current = read;
    return read;
  }, [projectId]);
  useEffect(() => {
    void startRead().promise.catch(() => {
      // The current read displays its error; superseded reads cannot replace it.
    });
    return invalidate;
  }, [refreshKey, reload, invalidate, startRead]);
  const latest = useCallback(async () => {
    let read = startRead();
    // An explicit reset must use the same response as the displayed source.
    // A save can also refresh the parent while this request is in flight.
    for (let attempt = 0; attempt < 8; attempt++) {
      const result = await Promise.race([
        read.promise.then(
          (value) => ({ kind: "ready" as const, value }),
          (error: unknown) => ({ kind: "error" as const, error }),
        ),
        read.superseded.then(() => ({ kind: "superseded" as const })),
      ]);
      if (read.generation === generation.current) {
        if (result.kind === "ready") return result.value;
        if (result.kind === "error") throw result.error;
      }
      const next = inFlight.current;
      if (!next || next.generation !== generation.current) break;
      read = next;
    }
    throw new Error("Source changed while resetting; fetch again");
  }, [startRead]);
  useEffect(() => {
    onDraftChange(formDirty || opDirty);
    return () => onDraftChange(false);
  }, [formDirty, opDirty, onDraftChange]);
  const changed = useCallback(() => {
    setReload((v) => v + 1);
    onChanged();
  }, [onChanged]);
  const op = useCaseAdminOperation(
    `natori-case-intake-op/${projectId}`,
    changed,
    setOpDirty,
  );
  return (
    <section
      hidden={section !== "overview" && section !== "consultation"}
      className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5"
      aria-label="元の依頼と受付資料"
    >
      <h3 className="text-lg font-semibold">元の依頼と受付資料</h3>
      <p className="mt-2 text-sm">
        依頼者の原回答・受付時のメモと、担当が管理する内容を分けて表示します。
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <button
        className={`${ui.btnSecondary} my-3`}
        onClick={() => setReload((v) => v + 1)}
      >
        依頼・資料を再取得
      </button>
      {view ? (
        <IntakeContent
          key={projectId}
          view={view}
          disabled={
            readOnly ||
            loading ||
            !op.ready ||
            !!op.saved ||
            op.blocked ||
            !!view.project.deletedAt ||
            view.project.status === "closed"
          }
          resetDisabled={
            readOnly || !op.ready || !!op.saved || op.blocked ||
            !!view.project.deletedAt || view.project.status === "closed"
          }
          onDirty={setFormDirty}
          latest={latest}
          prepare={(action, summary, revision) =>
            op.prepare(
              {
                projectId,
                operationId: crypto.randomUUID(),
                revision,
                action,
              },
              [view.project.title, ...summary],
            )
          }
        />
      ) : null}
      {!readOnly ? <CaseAdminConfirmation operation={op} /> : null}
    </section>
  );
}
function IntakeContent({
  view,
  disabled,
  resetDisabled,
  onDirty,
  prepare,
  latest,
}: {
  view: CaseContext;
  disabled: boolean;
  resetDisabled: boolean;
  onDirty: (v: boolean) => void;
  latest:()=>Promise<CaseContext>;
  prepare: (
    action: CaseAdminRequest["action"],
    summary: string[],
    revision: string,
  ) => void;
}) {
  const p = view.project,
    note = parseInquiryNote(p.note),
    request = buildNatoriInquiryRequestView(p.requestData);
  const [draft, setDraft, reset] = useCaseDraft(
    `natori-case-intake-draft/${p.id}`,
    {
      memo: p.nextAction,
      revision: view.revision,
      mode: "add",
      linkId: "",
      url: "",
      label: "",
    },
    onDirty,
  );
  const [error, setError] = useState("");
  const [resetting,setResetting]=useState(false);
  const stale = draft.revision !== view.revision;
  const save = (action: CaseAdminRequest["action"], summary: string[]) => {
    if (stale) {
      setError(
        "確認元が更新されました。入力を閉じて最新の保存内容を確認してください。",
      );
      return;
    }
    prepare(action, summary, draft.revision);
  };
  return (
    <div className="space-y-4">
      <InquiryRequestSummary view={request} />
      {request.kind === "legacy" ? (
        <section aria-label="旧形式の依頼記録">
          <h4 className="font-semibold">旧形式の依頼記録</h4>
          <p className="text-xs">
            受付メモの表示です。サイト上の承諾・送信・入金を確定する証拠ではありません。
          </p>
          <dl>
            {note.fields.map((f) => (
              <div key={f.label}>
                <dt className="font-semibold">{f.label}</dt>
                <dd className="whitespace-pre-wrap break-words">{f.value}</dd>
              </div>
            ))}
          </dl>
          <p className="whitespace-pre-wrap break-words">
            {note.details || note.plainNote || "原回答の保存記録なし"}
          </p>
          <p className="whitespace-pre-wrap">{note.message}</p>
          {note.refImages.map((url, i) =>
            normalizeNatoriReferenceUrl(url) ? (
              <a
                className="block underline"
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                旧資料{i + 1}を開く
              </a>
            ) : (
              <p key={i}>旧資料{i + 1}のURLを確認できません</p>
            ),
          )}
          <p className="whitespace-pre-wrap break-words">{note.refText}</p>
        </section>
      ) : null}
      <InquiryReferenceFiles
        files={view.files}
        acquisitionState={view.filesState}
      />
      <section aria-label="受付の参考リンク">
        <h4 className="font-semibold">参考リンク（{view.links.length}/5件）</h4>
        {view.links.length === 0 ? (
          <p>登録された参考リンクなし（取得済み）</p>
        ) : (
          <ul>
            {view.links.map((l) => (
              <li key={l.id} className="my-2 rounded-xl border p-3">
                {normalizeNatoriReferenceUrl(l.url) ? (
                  <a
                    className="break-all underline"
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {l.label || l.url}
                  </a>
                ) : (
                  <p>リンクのURLを確認できません</p>
                )}
                <button
                  className={`${ui.btnSecondary} ml-2`}
                  disabled={disabled || stale}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      mode: "edit",
                      linkId: l.id,
                      url: l.url,
                      label: l.label ?? "",
                    }))
                  }
                >
                  このリンクを編集
                </button>
                <button
                  className={`${ui.btnSecondary} ml-2`}
                  disabled={disabled || stale}
                  onClick={() =>
                    save(
                      {
                        command: "reference-link",
                        mode: "remove",
                        linkId: l.id,
                        url: "",
                        label: null,
                      },
                      [
                        "参考リンクだけを削除。受付資料ファイルと原回答は削除しません。",
                        l.label ?? l.url,
                        l.url,
                      ],
                    )
                  }
                >
                  このリンクの削除確認
                </button>
              </li>
            ))}
          </ul>
        )}
        <fieldset disabled={disabled || stale} className="space-y-2">
          <legend>
            {draft.mode === "edit" ? "参考リンクの編集" : "参考リンクの追加"}
          </legend>
          <label className="block">
            参考リンクURL
            <input
              className={ui.input}
              value={draft.url}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            />
          </label>
          <label className="block">
            リンクのラベル
            <input
              className={ui.input}
              maxLength={100}
              value={draft.label}
              onChange={(e) =>
                setDraft((d) => ({ ...d, label: e.target.value }))
              }
            />
          </label>
          <button
            className={ui.btnSecondary}
            onClick={() => {
              if (!normalizeNatoriReferenceUrl(draft.url)) {
                setError("認証情報を含まないHTTPSのURLを入力してください。");
                return;
              }
              setError("");
              save(
                {
                  command: "reference-link",
                  mode: draft.mode === "edit" ? "edit" : "add",
                  linkId: draft.linkId || null,
                  url: draft.url,
                  label: draft.label || null,
                },
                [
                  draft.mode === "edit"
                    ? "選択した参考リンクの更新"
                    : "参考リンクの追加",
                  draft.url,
                  draft.label,
                ],
              );
            }}
          >
            リンクの保存内容を確認
          </button>
        </fieldset>
      </section>
      <fieldset disabled={disabled || stale} className="space-y-2">
        <legend className="font-semibold">管理確認と次回メモ</legend>
        <p className="text-sm">
          金額・登録納期・納期プランは基本情報で確認保存できます。このメモは共通の状態判定や依頼者の対応待ちを変更しません。
        </p>
        <label className="block">
          担当の次回メモ
          <input
            className={ui.input}
            maxLength={120}
            value={draft.memo}
            onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
          />
        </label>
        <button
          className={ui.btnSecondary}
          onClick={() =>
            save({ command: "intake-memo", text: draft.memo }, [
              "担当の次回メモだけを保存（進捗・承諾・入金は変更しません）",
              draft.memo,
            ])
          }
        >
          次回メモの保存内容を確認
        </button>
      </fieldset>
      <button
        className={ui.btnSecondary}
        // This explicit read/discard can supersede an automatic read. Loading
        // must not cancel its click between pointerdown and pointerup.
        disabled={resetDisabled||resetting}
        onClick={() =>{setResetting(true);void latest().then(fresh=>{reset({memo:fresh.project.nextAction,revision:fresh.revision,mode:"add",linkId:"",url:"",label:""});setError("");}).catch(()=>setError("最新の保存内容を取得できません。古い入力を保持し、保存は行っていません。")).finally(()=>setResetting(false));}}
      >
        入力を閉じて最新の保存内容を使う
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {stale ? (
        <p role="alert">
          確認元が更新されました。古い入力からの保存は停止しています。「入力を閉じて最新の保存内容を使う」で確認し直してください。
        </p>
      ) : null}
    </div>
  );
}
