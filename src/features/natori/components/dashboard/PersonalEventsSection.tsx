"use client";

import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { useNatoriConfirm } from "@/features/natori/components/admin/useNatoriConfirm";
import { useState } from "react";
import { CalendarPlus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NatoriEvent } from "@/features/natori/data/supabaseEvents";

type PersonalEventsSectionProps = {
  selectedISO: string;
  events: NatoriEvent[];
  authed: boolean;
  busy: boolean;
  error: string | null;
  onCreate: (input: { title: string; date: string; note?: string }) => Promise<void>;
  onUpdate: (id: string, input: { title: string; date: string; note?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export default function PersonalEventsSection({
  selectedISO,
  events,
  authed,
  busy,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: PersonalEventsSectionProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [adding, setAdding] = useState(false);
  const { confirm, confirmDialog } = useNatoriConfirm();

  const handleDelete = async (event: NatoriEvent) => {
    const confirmed = await confirm({
      title: "予定を削除しますか？",
      description: `予定「${event.title}」を削除します。よろしいですか？`,
      confirmLabel: "予定を削除",
      tone: "danger",
    });
    if (!confirmed) return;
    await onDelete(event.id);
  };

  const dayEvents = events
    .filter((event) => event.date === selectedISO)
    .sort((a, b) => a.title.localeCompare(b.title, "ja"));

  const beginAdd = () => {
    setEditingId(null);
    setAdding(true);
    setDraftTitle("");
    setDraftNote("");
  };

  const beginEdit = (event: NatoriEvent) => {
    setAdding(false);
    setEditingId(event.id);
    setDraftTitle(event.title);
    setDraftNote(event.note ?? "");
  };

  const cancel = () => {
    setEditingId(null);
    setAdding(false);
    setDraftTitle("");
    setDraftNote("");
  };

  const submit = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    const note = draftNote.trim() || undefined;
    try {
      if (editingId) {
        await onUpdate(editingId, { title, date: selectedISO, note });
      } else {
        await onCreate({ title, date: selectedISO, note });
      }
      cancel();
    } catch {
      // Parent surfaces the error via the `error` prop; keep the draft visible.
    }
  };

  const draftActive = adding || editingId !== null;

  return (
    <section className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3 sm:p-4">
      {confirmDialog}
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-700">この日の予定</p>
        {authed && !draftActive ? (
          <Button
            onClick={beginAdd}
            variant="outline"
            className="h-8 rounded-full border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 shadow-[0_1px_2px_rgba(24,24,27,0.05)] hover:border-zinc-300 hover:bg-zinc-50"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            予定を追加
          </Button>
        ) : null}
      </div>

      {!authed ? (
        <p className={`${natoriAdminUi.alert.warning} mt-2 text-xs leading-5`}>
          サーバーに接続できると個人の予定を追加・編集できます。
        </p>
      ) : null}

      {error ? (
        <p className={`${natoriAdminUi.alert.error} mt-2 text-xs font-semibold`}>
          {error}
        </p>
      ) : null}

      {dayEvents.length === 0 && !draftActive ? (
        <p className="mt-2 text-xs text-zinc-500">この日に予定はありません。</p>
      ) : null}

      {dayEvents.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {dayEvents.map((event) => (
            <li
              key={event.id}
              className={cn(
                "flex flex-col gap-1 rounded-lg border border-zinc-200/80 bg-white px-3 py-2",
                editingId === event.id && "border-[#BE185D]/40 ring-2 ring-[#BE185D]/10"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-2 break-words text-sm font-semibold text-zinc-900">
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-purple-500" />
                  {event.title}
                </p>
                {authed ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => beginEdit(event)}
                      className={natoriAdminUi.btnIcon}
                      aria-label={`予定「${event.title}」を編集`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(event)}
                      className={`${natoriAdminUi.btnIcon} disabled:opacity-50`}
                      aria-label={`予定「${event.title}」を削除`}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4 text-red-700" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
              {event.note ? (
                <p className="break-words pl-4 text-xs leading-5 text-zinc-600">{event.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {draftActive ? (
        <div className="mt-3 rounded-xl border border-zinc-200/80 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-zinc-700">
              {editingId ? "予定を編集" : "予定を追加"}
            </p>
            <button
              type="button"
              onClick={cancel}
              className={natoriAdminUi.btnIcon}
              aria-label="閉じる"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <label className="block">
            <span className="block text-xs font-semibold text-zinc-700">タイトル</span>
            <input
              type="text"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="例: 病院、打ち合わせ、旅行..."
              className={`${natoriAdminUi.input} mt-1`}
              autoFocus
            />
          </label>
          <label className="mt-2 block">
            <span className="block text-xs font-semibold text-zinc-700">メモ（任意）</span>
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              rows={2}
              className={`${natoriAdminUi.input} mt-1`}
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              onClick={cancel}
              variant="outline"
              className={natoriAdminUi.btnSecondary}
            >
              キャンセル
            </Button>
            <Button
              onClick={submit}
              disabled={busy || !draftTitle.trim()}
              className={natoriAdminUi.btnPrimary}
            >
              {busy ? "保存中…" : editingId ? "更新" : "追加"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
