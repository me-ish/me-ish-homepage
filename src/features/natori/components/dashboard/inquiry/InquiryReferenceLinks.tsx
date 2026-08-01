"use client";

// 外部参照リンクの一覧・追加・編集・削除。
// 検証と保存は server service（referenceLinks.ts が正規化の真実源）が担当し、
// ここは操作 UI と楽観 UI を持たない素直な再取得だけを行う。
//
// 並び替えは複数行の sort_order 更新が必要で、原子的な RPC 無しでは
// 部分適用が残るため P1-07 では提供しない。表示は API が返す
// sort_order ASC / created_at ASC の順をそのまま使い、数値は利用者へ見せない。
//
// URL へは一切アクセスしない（プレビュー・favicon・OGP を取得しない）。
import { useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { NATORI_PROJECT_REFERENCE_LINK_MAX } from "@/features/natori/lib/projectReferenceLinks";
import type { NatoriProjectReferenceLinkView } from "@/features/natori/types/projects";

export type InquiryReferenceLinksProps = {
  links: NatoriProjectReferenceLinkView[];
  /** archived 案件などで変更を止めるとき。 */
  readOnly?: boolean;
  onAdd: (url: string, label: string | null) => Promise<void>;
  onUpdate: (linkId: string, url: string, label: string | null) => Promise<void>;
  onDelete: (linkId: string) => Promise<void>;
};

export default function InquiryReferenceLinks({
  links,
  readOnly,
  onAdd,
  onUpdate,
  onDelete,
}: InquiryReferenceLinksProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const canAdd = !readOnly && links.length < NATORI_PROJECT_REFERENCE_LINK_MAX;

  /** 保存中の重複操作を止めつつ、失敗しても既存の一覧は保持する。 */
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (link: NatoriProjectReferenceLinkView) => {
    setEditingId(link.id);
    setEditUrl(link.url);
    setEditLabel(link.label ?? "");
  };

  return (
    <section aria-labelledby="inquiry-links-heading">
      <h3
        id="inquiry-links-heading"
        className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700"
      >
        外部リンク（{links.length}/{NATORI_PROJECT_REFERENCE_LINK_MAX}件）
      </h3>

      {links.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
          外部リンクは登録されていません。
        </p>
      ) : (
        <ul className="space-y-2">
          {links.map((link, index) => (
            <li
              key={link.id}
              data-link-id={link.id}
              className="rounded-xl border border-pink-100 bg-white p-2 shadow-sm"
            >
              {editingId === link.id ? (
                <div className="space-y-2">
                  <div>
                    <label
                      htmlFor={`link-url-${link.id}`}
                      className="mb-1 block text-[11px] font-bold text-gray-600"
                    >
                      URL
                    </label>
                    <input
                      id={`link-url-${link.id}`}
                      value={editUrl}
                      onChange={(event) => setEditUrl(event.target.value)}
                      className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`link-label-${link.id}`}
                      className="mb-1 block text-[11px] font-bold text-gray-600"
                    >
                      ラベル（任意）
                    </label>
                    <input
                      id={`link-label-${link.id}`}
                      value={editLabel}
                      onChange={(event) => setEditLabel(event.target.value)}
                      maxLength={100}
                      className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await onUpdate(link.id, editUrl, editLabel.trim() || null);
                          setEditingId(null);
                        })
                      }
                      className="inline-flex h-8 items-center rounded-full bg-pink-500 px-3 text-xs font-bold text-white disabled:opacity-60"
                    >
                      {busy ? "保存中…" : "保存"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-gray-300 px-3 text-xs font-bold text-gray-600"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">
                      {link.label ?? "（ラベルなし）"}
                    </p>
                    <p className="truncate text-[11px] text-gray-600" title={link.url}>
                      {link.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-gray-300 px-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      開く
                    </a>
                    {readOnly ? null : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit(link)}
                          disabled={busy}
                          aria-label={`${index + 1}番目のリンクを編集`}
                          className="grid h-8 w-8 place-items-center rounded-full border border-gray-300 text-gray-600 disabled:opacity-40"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              !window.confirm(
                                `このリンクを削除します。よろしいですか？\n${link.label ?? link.url}`
                              )
                            ) {
                              return;
                            }
                            void run(() => onDelete(link.id));
                          }}
                          disabled={busy}
                          aria-label={`${index + 1}番目のリンクを削除`}
                          className="grid h-8 w-8 place-items-center rounded-full border border-rose-300 text-rose-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[11px] text-gray-500">
        リンク先が開けない場合はURLを確認してください。この画面からリンク先の内容は取得していません。
      </p>

      {canAdd ? (
        <div className="mt-3 space-y-2 rounded-xl border border-pink-100 bg-pink-50/40 p-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="inquiry-new-link-url"
                className="mb-1 block text-[11px] font-bold text-gray-600"
              >
                URLを追加（https:// のみ）
              </label>
              <input
                id="inquiry-new-link-url"
                value={newUrl}
                onChange={(event) => setNewUrl(event.target.value)}
                placeholder="https://"
                className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="inquiry-new-link-label"
                className="mb-1 block text-[11px] font-bold text-gray-600"
              >
                ラベル（任意）
              </label>
              <input
                id="inquiry-new-link-label"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                maxLength={100}
                className="h-9 w-full rounded-lg border border-gray-300 px-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy || newUrl.trim() === ""}
            onClick={() =>
              void run(async () => {
                await onAdd(newUrl, newLabel.trim() || null);
                setNewUrl("");
                setNewLabel("");
              })
            }
            className="inline-flex h-8 items-center gap-1 rounded-full bg-pink-500 px-3 text-xs font-bold text-white disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {busy ? "追加中…" : "リンクを追加"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-xs font-bold text-rose-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
