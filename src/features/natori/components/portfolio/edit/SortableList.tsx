"use client";

// features/natori/components/portfolio/edit/SortableList.tsx
// 編集画面のリストをドラッグ＆ドロップで並び替えるための汎用コンポーネント。
// 各行に渡される handle（つまみ）をドラッグして並び替える。
// マウス・タッチ・キーボード（ハンドルにフォーカスして Space → 矢印キー）に対応。
import { type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type PortfolioWorkLike = {
  title: string;
  published: boolean;
  image: unknown;
  collectionId: unknown;
  featured: unknown;
};

function isPortfolioWorkLike(item: unknown): item is PortfolioWorkLike {
  if (!item || typeof item !== "object") return false;
  const candidate = item as Record<string, unknown>;
  return (
    typeof candidate.title === "string" &&
    typeof candidate.published === "boolean" &&
    "image" in candidate &&
    "collectionId" in candidate &&
    "featured" in candidate
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="grid h-8 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600 active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-pink-300"
      aria-label="ドラッグして並び替え"
      title="ドラッグして並び替え"
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "relative z-10 opacity-70" : undefined}
    >
      {children(handle)}
    </div>
  );
}

function CompactWorkRow({
  id,
  index,
  title,
  published,
}: {
  id: string;
  index: number;
  title: string;
  published: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-11 items-center gap-2 rounded-lg border bg-white px-2 py-1.5 shadow-sm ${
        isDragging ? "relative z-10 border-pink-300 opacity-80" : "border-pink-100"
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="grid h-8 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-pink-300"
        aria-label={`${title || `作品${index + 1}`}をドラッグして並び替え`}
        title="ドラッグして並び替え"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span className="w-6 shrink-0 text-center text-xs font-black text-pink-500">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800">
        {title.trim() || "無題"}
      </span>
      {!published ? (
        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">
          非公開
        </span>
      ) : null}
    </div>
  );
}

export default function SortableList<T>({
  items,
  onReorder,
  renderRow,
  getId,
  className,
}: {
  items: T[];
  /** ドロップ確定時に並び替え後の配列を受け取る */
  onReorder: (next: T[]) => void;
  /** handle を行内の好きな位置（削除ボタンの隣など）に置く */
  renderRow: (item: T, index: number, handle: ReactNode) => ReactNode;
  /**
   * 行の識別子。固有IDを持つ要素（作品など）はそれを渡す。
   * 省略時はインデックスを使う（並び替えはドロップ時にまとめて反映されるので安全）。
   */
  getId?: (item: T, index: number) => string;
  className?: string;
}) {
  const ids = items.map((item, index) => (getId ? getId(item, index) : `row-${index}`));
  const compactWorkMode = items.length > 0 && items.every(isPortfolioWorkLike);

  const sensors = useSensors(
    // distance を入れて、ハンドルの単純クリックではドラッグ扱いにしない
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };

  if (compactWorkMode) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-pink-200 bg-pink-50/50 p-3">
          <div className="mb-2">
            <p className="text-xs font-black text-pink-700">公開ページの並び順</p>
            <p className="mt-0.5 text-[11px] leading-4 text-gray-600">
              上から順に表示されます。並び替えはこのコンパクトな一覧で行ってください。
            </p>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {items.map((item, index) => {
                  const work = item as T & PortfolioWorkLike;
                  return (
                    <CompactWorkRow
                      key={ids[index]}
                      id={ids[index]}
                      index={index}
                      title={work.title}
                      published={work.published}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className={className}>
          {items.map((item, index) => (
            <div key={ids[index]}>{renderRow(item, index, null)}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow key={ids[index]} id={ids[index]}>
              {(handle) => renderRow(item, index, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
