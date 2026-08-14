"use client";

// features/natori/components/portfolio/PortfolioGallery.tsx
// 作品ギャラリー。マスキングテープで貼ったポラロイド風のカードを並べる。
// 画像はX(Twitter)の縦長表示に近い 3:4 で見せ、クリックでモーダル拡大表示。
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  placeholderPalettes,
  portfolioColors as c,
  portfolioDecorativeColors as d,
  workRotations,
} from "@/features/natori/constants/portfolioContent";
import { publicPortfolioWorkTags } from "@/features/natori/lib/portfolioContent";
import type {
  PortfolioCollection,
  PortfolioWork,
} from "@/features/natori/types/portfolio";
import ChibiFace from "./ChibiFace";

const COLLECTION_PREVIEW_LIMIT = 3;

function MaskingTape({ color, angle }: { color: string; angle: number }) {
  return (
    <span
      className="absolute -top-3 left-1/2 z-10 h-6 w-20 rounded-[2px]"
      aria-hidden="true"
      style={{
        // テープの半透明感と光沢。両端をわずかにギザギザに見せる
        background: `linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0) 45%), ${color}`,
        opacity: 0.85,
        transform: `translateX(-50%) rotate(${angle}deg)`,
        boxShadow: "0 1px 2px rgba(36,36,36,0.16)",
        clipPath:
          "polygon(2% 0%, 98% 0%, 100% 18%, 98% 38%, 100% 60%, 98% 80%, 100% 100%, 2% 100%, 0% 78%, 2% 58%, 0% 38%, 2% 20%)",
      }}
    />
  );
}

// client component のため props は RSC ペイロードとして HTML ソースに埋め込まれる。
// content 丸ごとを渡すと SNS リンクや料金までソースに露出するので works だけ受け取る
// （/natori/works を営業先に見せる際にソースにも販売導線を残さないため）。
export default function PortfolioGallery({
  works,
  collections,
  flatPlaceholders,
}: {
  works: PortfolioWork[];
  collections: PortfolioCollection[];
  /** 画像なし作品のプレースホルダーをキャラSVGではなくベタ塗りにする（デモ用） */
  flatPlaceholders?: boolean;
}) {
  const [selected, setSelected] = useState<PortfolioWork | null>(null);
  const [expandedCollectionIds, setExpandedCollectionIds] = useState<
    Set<string>
  >(() => new Set());
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);

  const collectionGroups = collections
    .map((collection) => ({
      collection,
      works: works
        .filter((work) => work.published && work.collectionId === collection.id)
        .toSorted((a, b) => Number(b.featured) - Number(a.featured)),
    }))
    .filter((group) => group.works.length > 0);
  const unassignedWorks = works.filter(
    (work) =>
      work.published &&
      (work.collectionId === null ||
        !collections.some((collection) => collection.id === work.collectionId)),
  );
  const groups =
    unassignedWorks.length > 0
      ? [
          ...collectionGroups,
          {
            collection: {
              id: "unassigned",
              name: "その他",
              description: "",
              color: c.accentSoft,
            },
            works: unassignedWorks,
          },
        ]
      : collectionGroups;

  const closeModal = useCallback(() => setSelected(null), []);

  const openModal = (work: PortfolioWork, trigger: HTMLButtonElement) => {
    modalTriggerRef.current = trigger;
    setSelected(work);
  };

  // モーダル表示中はフォーカスを内部に保ち、Esc で閉じ、背景のスクロールを止める。
  // close 後は作品カードへフォーカスを戻す。
  useEffect(() => {
    if (!selected) return;
    const trigger = modalTriggerRef.current;
    closeButtonRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      trigger?.focus();
    };
  }, [closeModal, selected]);

  const toggleCollection = (collectionId: string) => {
    setExpandedCollectionIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  };

  const selectedCollection = selected
    ? (collections.find(
        (collection) => collection.id === selected.collectionId,
      ) ?? null)
    : null;

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10">
        <h2 className="text-2xl font-black md:text-3xl">
          作品ギャラリー <span style={{ color: d.sparkleCool }}>°˖✧</span>
        </h2>
        <p className="mt-2 text-sm" style={{ color: c.textSoft }}>
          ジャンルごとに代表作品をご覧いただけます。
        </p>
      </div>

      <div className="space-y-14">
        {groups.map(({ collection, works: collectionWorks }) => {
          const expanded = expandedCollectionIds.has(collection.id);
          const shownWorks = expanded
            ? collectionWorks
            : collectionWorks.slice(0, COLLECTION_PREVIEW_LIMIT);
          return (
            <section
              key={collection.id}
              aria-labelledby={`collection-${collection.id}`}
            >
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                  <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: collection.color }}
                      aria-hidden="true"
                  />
                    <h3
                      id={`collection-${collection.id}`}
                      className="text-xl font-black md:text-2xl"
                    >
                      {collection.name}
                    </h3>
                      <span
                      className="text-xs font-bold"
                      style={{ color: c.textSoft }}
                      >
                      {collectionWorks.length}作品
                  </span>
                  </div>
                  {collection.description ? (
                    <p className="mt-2 text-sm" style={{ color: c.textSoft }}>
                      {collection.description}
                    </p>
                ) : null}
              </div>
            </div>
              <div className="grid gap-x-8 gap-y-10 pt-2 sm:grid-cols-2 lg:grid-cols-3">
                {shownWorks.map((work, index) => (
                  <PortfolioWorkCard
                    key={work.id}
                    work={work}
                    index={index}
                    collection={collection}
                    flatPlaceholder={flatPlaceholders}
                    onSelect={openModal}
                  />
                ))}
              </div>
              {collectionWorks.length > COLLECTION_PREVIEW_LIMIT ? (
                <div className="mt-7 text-center">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleCollection(collection.id)}
                    className="pf-cute-focus rounded-full border-2 px-5 py-2.5 text-sm font-bold"
                    style={{
                      borderColor: collection.color,
                      background: c.surface,
                      color: c.text,
                    }}
                  >
                    {expanded
                      ? "代表作品だけ表示"
                      : `${collectionWorks.length}作品をすべて見る`}
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      {groups.length === 0 ? (
        <p
          className="py-10 text-center text-sm font-bold"
          style={{ color: c.textSoft }}
        >
          公開中の作品はまだありません。
        </p>
      ) : null}

      {/* 拡大表示モーダル。背景クリック / ×ボタン / Esc で閉じる */}
      {selected?.image ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          tabIndex={-1}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          style={{ background: c.overlay }}
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-full w-full max-w-3xl flex-col rounded-xl p-3 pb-4"
            style={{
              background: c.surface,
              boxShadow: "0 20px 40px rgba(36,36,36,0.26)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeModal}
              aria-label="閉じる"
              className="pf-cute-focus absolute -right-3 -top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full font-bold shadow-md hover:brightness-105"
              style={{ background: c.action, color: c.onAction }}
            >
              ✕
            </button>
            <div
              className="relative h-[70vh] w-full overflow-hidden rounded-lg md:h-[76vh]"
              style={{ background: c.surfaceSubtle }}
            >
              <Image
                src={selected.image}
                alt={selected.title}
                fill
                sizes="(min-width: 768px) 768px, calc(100vw - 32px)"
                className="object-contain"
              />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 px-1">
              <p className="min-w-0 truncate font-bold">{selected.title}</p>
              {selectedCollection ||
              publicPortfolioWorkTags(selected.tags).length > 0 ? (
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {selectedCollection ? (
                    <span
                      className="rounded-full px-2 py-1 text-xs font-bold"
                      style={{
                        background: selectedCollection.color,
                        color: c.text,
                      }}
                    >
                      {selectedCollection.name}
                    </span>
                  ) : null}
                  {publicPortfolioWorkTags(selected.tags).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-1 text-xs font-bold"
                      style={{ background: c.surfaceSubtle, color: c.text }}
                    >
                      {tag}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PortfolioWorkCard({
  work,
  index,
  collection,
  flatPlaceholder,
  onSelect,
}: {
  work: PortfolioWork;
  index: number;
  collection: PortfolioCollection;
  flatPlaceholder?: boolean;
  onSelect: (work: PortfolioWork, trigger: HTMLButtonElement) => void;
}) {
  const palette = placeholderPalettes[index % placeholderPalettes.length];
  const rotate = workRotations[index % workRotations.length];
  const tapeAngle = index % 2 === 0 ? -4 : 3;
  const publicTags = publicPortfolioWorkTags(work.tags);

  return (
    <div
      className={`pf-pin-card ${rotate} relative rounded-xl p-3 pb-4 pt-5`}
      style={{
        background: c.surface,
        boxShadow: "0 10px 20px rgba(36,36,36,0.08)",
      }}
    >
      <MaskingTape color={collection.color} angle={tapeAngle} />
      <button
        type="button"
        onClick={work.image ? (event) => onSelect(work, event.currentTarget) : undefined}
        aria-label={work.image ? `${work.title} を拡大表示` : undefined}
        className={`pf-cute-focus relative mb-3 flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg ${
          work.image ? "cursor-zoom-in" : "cursor-default"
        }`}
        style={{ background: c.surfaceSubtle }}
      >
        {work.image ? (
          <Image
            src={work.image}
            alt={work.title}
            fill
            sizes="(min-width: 1024px) 352px, (min-width: 640px) calc(50vw - 36px), calc(100vw - 40px)"
            className="object-cover"
          />
        ) : flatPlaceholder ? (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ background: palette.hair }}
          />
        ) : (
          <ChibiFace
            size={110}
            skin={palette.skin}
            hair={palette.hair}
            accent={palette.accent}
          />
        )}
      </button>
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate font-bold">{work.title}</p>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          <span
            className="rounded-full px-2 py-1 text-xs font-bold"
            style={{ background: collection.color, color: c.text }}
          >
            {collection.name}
          </span>
          {publicTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2 py-1 text-xs font-bold"
              style={{ background: c.surfaceSubtle, color: c.textSoft }}
            >
              {tag}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
