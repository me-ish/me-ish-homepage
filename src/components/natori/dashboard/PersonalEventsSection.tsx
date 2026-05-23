"use client";

import { useState } from "react";
import { CalendarPlus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NatoriEvent } from "@/lib/natori/supabaseEvents";

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
    <section className="mt-4 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-pink-700">この日の予定</p>
        {authed && !draftActive ? (
          <Button
            onClick={beginAdd}
            variant="outline"
            className="h-8 rounded-full border-pink-300 bg-white px-3 text-xs font-bold text-pink-700 hover:bg-pink-50"
          >
            <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
            予定を追加
          </Button>
        ) : null}
      </div>

      {!authed ? (
        <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          ログインすると個人の予定を追加・編集できます。
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </p>
      ) : null}

      {dayEvents.length === 0 && !draftActive ? (
        <p className="mt-2 text-xs text-gray-500">この日に予定はありません。</p>
      ) : null}

      {dayEvents.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {dayEvents.map((event) => (
            <li
              key={event.id}
              className={cn(
                "flex flex-col gap-1 rounded-xl border border-pink-100 bg-pink-50/40 px-3 py-2",
                editingId === event.id && "border-pink-300 bg-pink-50"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words text-sm font-bold text-gray-900">
                  {event.title}
                </p>
                {authed ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => beginEdit(event)}
                      className="grid h-7 w-7 place-items-center rounded-full border border-pink-200 bg-white text-pink-700 hover:bg-pink-50"
                      aria-label="編集"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(event.id)}
                      className="grid h-7 w-7 place-items-center rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label="削除"
                      disabled={busy}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </div>
              {event.note ? (
                <p className="break-words text-xs leading-5 text-gray-700">{event.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {draftActive ? (
        <div className="mt-3 rounded-xl border border-pink-200 bg-pink-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-pink-700">
              {editingId ? "予定を編集" : "予定を追加"}
            </p>
            <button
              type="button"
              onClick={cancel}
              className="grid h-7 w-7 place-items-center rounded-full text-gray-500 hover:bg-white"
              aria-label="閉じる"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <label className="block">
            <span className="block text-[11px] font-bold text-pink-700">タイトル</span>
            <input
              type="text"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              placeholder="例: 病院、打ち合わせ、旅行..."
              className="mt-1 h-10 w-full rounded-lg border border-pink-200 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
              autoFocus
            />
          </label>
          <label className="mt-2 block">
            <span className="block text-[11px] font-bold text-pink-700">メモ（任意）</span>
            <textarea
              value={draftNote}
              onChange={(event) => setDraftNote(event.target.value)}
              rows={2}
              className="mt-1 w-full resize-y rounded-lg border border-pink-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-300"
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              onClick={cancel}
              variant="outline"
              className="h-9 rounded-full border-gray-300 bg-white px-4 text-xs font-bold text-gray-800 hover:bg-gray-50"
            >
              キャンセル
            </Button>
            <Button
              onClick={submit}
              disabled={busy || !draftTitle.trim()}
              className="h-9 rounded-full bg-pink-500 px-4 text-xs font-bold text-white hover:bg-pink-600 disabled:opacity-60"
            >
              {busy ? "保存中…" : editingId ? "更新" : "追加"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
