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
