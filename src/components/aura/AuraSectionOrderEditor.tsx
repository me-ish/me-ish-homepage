"use client";

import React from "react";

const SECTION_LABELS: Record<string, string> = {
  hero: "HERO（トップ）",
  about: "ABOUT（自己紹介）",
  works: "WORKS（作品）",
  services: "SERVICES（サービス）",
  skills: "SKILLS（スキル）",
  contact: "CONTACT（連絡先）",
  // cta は削除（締めメッセージを廃止）
};

type Props = {
  sectionOrder: string[];
  onChange: (next: string[]) => void;
};

/** 旧データ対策：cta や未知キーを弾いて正規化 */
function normalizeOrder(input: string[]): string[] {
  const allowed = new Set(Object.keys(SECTION_LABELS));
  const seen = new Set<string>();
  const out: string[] = [];

  for (const key of input ?? []) {
    if (!allowed.has(key)) continue;
    if (seen.has(key)) continue; // 重複防止
    seen.add(key);
    out.push(key);
  }

  return out;
}

function reorder(list: string[], from: number, to: number): string[] {
  if (from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function AuraSectionOrderEditor({
  sectionOrder,
  onChange,
}: Props) {
  const order = React.useMemo(
    () => normalizeOrder(sectionOrder),
    [sectionOrder],
  );

  // 正規化で落ちたものがある場合は親へ反映（cta混入など）
  React.useEffect(() => {
    if (order.length !== (sectionOrder?.length ?? 0)) {
      onChange(order);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.length]);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragIndex(index);
    setOverIndex(index);

    // Firefox 対策：dataTransfer が空だと drag が始まらないことがある
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault(); // drop を許可
    if (overIndex !== index) setOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();

    const raw = e.dataTransfer.getData("text/plain");
    const from = dragIndex ?? (raw ? Number(raw) : NaN);
    if (!Number.isFinite(from)) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    const next = reorder(order, from, index);
    onChange(next);

    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <section className="mt-8 rounded-xl border bg-white/70 p-4 text-left shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800">
        セクションの表示順
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        ドラッグ＆ドロップで順番を入れ替えると、上のプレビューにも即反映されます。
        （保存ロジックはこのあと実装予定）
      </p>

      <ul className="mt-3 space-y-2 text-sm">
        {order.map((type, index) => {
          const isDragging = dragIndex === index;
          const isOver = overIndex === index && dragIndex !== null;

          return (
            <li
              key={type}
              draggable
              onDragStart={handleDragStart(index)}
              onDragOver={handleDragOver(index)}
              onDrop={handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={[
                "flex items-center justify-between rounded-lg border px-3 py-2",
                "bg-gray-50",
                "cursor-grab select-none",
                "transition",
                isDragging ? "opacity-50" : "",
                isOver ? "ring-2 ring-black/10" : "",
              ].join(" ")}
              aria-label={`section-${type}`}
              title="ドラッグして並べ替え"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{index + 1}</span>

                {/* ドラッグハンドル風 */}
                <span
                  className="text-gray-400"
                  aria-hidden
                  style={{ letterSpacing: "0.12em" }}
                >
                  ⋮⋮
                </span>

                <span className="font-medium text-gray-800">
                  {SECTION_LABELS[type] ?? type}
                </span>
              </div>

              <span className="text-[11px] text-gray-400">
                drag
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
