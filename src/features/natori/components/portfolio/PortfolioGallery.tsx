"use client";

// features/natori/components/portfolio/PortfolioGallery.tsx
// ご依頼実績。マスキングテープで貼ったポラロイド風のカードを並べる。
// 画像はX(Twitter)の縦長表示に近い 3:4 で見せ、クリックでモーダル拡大表示。
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  placeholderPalettes,
  portfolioColors as c,
  workRotations,
} from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import { publicPortfolioWorkTags } from "@/features/natori/lib/portfolioContent";
import { portfolioGalleryEventLabel } from "@/features/natori/lib/pageEvents";
import type {
  PortfolioCollection,
  PortfolioVariant,
  PortfolioWork,
} from "@/features/natori/types/portfolio";
import ChibiFace from "./ChibiFace";
import PortfolioWorkRelatedLinks from "./PortfolioWorkRelatedLinks";

const GALLERY_PREVIEW_LIMIT = 6;

function formatProductionMonth(value?: string | null): string | null {
  if (!value) return null;
  const [year, month] = value.split("-");
  const monthNumber = Number(month);
  if (!year || !Number.isInteger(monthNumber)) return null;
  return `${year}年${monthNumber}月制作`;
}

function MaskingTape({ color, angle }: { color: string; angle: number }) {
  return (
    <span
      className="absolute -top-3 left-1/2 z-10 h-5 w-12 rounded-[2px] sm:h-6 sm:w-20"
      aria-hidden="true"
      style={{
        // テープの半透明感と光沢。両端をわずかにギザギザに見せる
        background: `linear-gradient(rgba(255,255,255,0.35), rgba(255,255,255,0) 45%), ${color}`,
        opacity: 0.85,
        transform: `translateX(-50%) rotate(${angle}deg)`,
        boxShadow: `0 1px 2px ${c.shadowHover}`,
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
  variant = "full",
  flatPlaceholders,
}: {
  works: PortfolioWork[];
  collections: PortfolioCollection[];
  variant?: PortfolioVariant;
  /** 画像なし作品のプレースホルダーをキャラSVGではなくベタ塗りにする（デモ用） */
  flatPlaceholders?: boolean;
}) {
  const [selected, setSelected] = useState<PortfolioWork | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);

  const unassignedCollection: PortfolioCollection = {
    id: "unassigned",
    name: "その他",
    description: "",
    color: c.accentSoft,
  };
  const publishedWorks = works.filter((work) => work.published);
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));

  // 編集画面で保存された works の配列順を公開ページの唯一の表示順とする。
  // featured やカテゴリによる再ソートは行わず、絞り込み時も元の相対順を維持する。
  const orderedWorks = publishedWorks.map((work) => ({
    work,
    collection: work.collectionId
      ? (collectionById.get(work.collectionId) ?? unassignedCollection)
      : unassignedCollection,
  }));

  const collectionGroups = collections
    .map((collection) => ({
      collection,
      works: publishedWorks.filter((work) => work.collectionId === collection.id),
    }))
    .filter((group) => group.works.length > 0);
  const unassignedWorks = orderedWorks
    .filter(({ collection }) => collection.id === unassignedCollection.id)
    .map(({ work }) => work);
  const groups =
    unassignedWorks.length > 0
      ? [
          ...collectionGroups,
          {
            collection: unassignedCollection,
            works: unassignedWorks,
          },
        ]
      : collectionGroups;

  const closeModal = useCallback(() => setSelected(null), []);

  const openModal = (
    work: PortfolioWork,
    collectionName: string,
    trigger: HTMLButtonElement
  ) => {
    modalTriggerRef.current = trigger;
    trackNatoriPageEvent(
      "portfolio_gallery_open",
      portfolioGalleryEventLabel(collectionName, work.title)
    );
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

  const activeCollection = groups.find((group) => group.collection.id === activeCollectionId);
  const filteredWorks = activeCollection
    ? orderedWorks.filter(
        ({ collection }) => collection.id === activeCollection.collection.id,
      )
    : orderedWorks;
  const shownWorks = expanded ? filteredWorks : filteredWorks.slice(0, GALLERY_PREVIEW_LIMIT);

  const selectedCollection = selected
    ? (collections.find(
        (collection) => collection.id === selected.collectionId,
      ) ?? null)
    : null;

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10">
        <h2 className="text-2xl font-black md:text-3xl">
          ご依頼実績 <span style={{ color: c.highlight }}>°˖✧</span>
        </h2>
      </div>

      {groups.length > 0 ? (
        <>
          <div role="group" aria-label="作品のカテゴリ" className="mb-5 flex flex-wrap gap-2">
            {[{ id: null, name: "すべて" }, ...groups.map((group) => group.collection)].map((collection) => (
              <button
                key={collection.id ?? "all"}
                type="button"
                aria-pressed={collection.id === (activeCollection?.collection.id ?? null)}
                aria-controls="portfolio-gallery-results"
                onClick={() => {
                  setActiveCollectionId(collection.id);
                  setExpanded(false);
                }}
                className="pf-cute-focus min-h-[44px] rounded-full border-2 px-4 py-2 text-sm font-bold"
                style={{
                  background: collection.id === (activeCollection?.collection.id ?? null) ? c.accentSoft : c.surface,
                  borderColor: collection.id === (activeCollection?.collection.id ?? null) ? c.accentDisplay : c.borderSubtle,
                  color: c.text,
                }}
              >
                {collection.name}
              </button>
            ))}
          </div>
          <div className="mb-6" style={{ color: c.textSoft }}>
            <p role="status" className="text-sm">
              {activeCollection?.collection.name ?? "すべての作品"}：{filteredWorks.length}作品中{shownWorks.length}作品を表示
            </p>
            {shownWorks.some(({ work }) => work.image) ? (
              <p className="mt-1 text-xs">画像をタップ・クリックで拡大できます。</p>
            ) : null}
          </div>
          {activeCollection?.collection.description ? (
            <p className="mb-6 text-sm" style={{ color: c.textSoft }}>{activeCollection.collection.description}</p>
          ) : null}
          <div id="portfolio-gallery-results" className="grid grid-cols-2 gap-x-4 gap-y-8 pt-2 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-3">
            {shownWorks.map(({ work, collection }, index) => (
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
          {filteredWorks.length > GALLERY_PREVIEW_LIMIT ? (
            <div className="mt-8 text-center">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls="portfolio-gallery-results"
                onClick={() => setExpanded((current) => !current)}
                className="pf-cute-focus min-h-[44px] rounded-full border-2 px-5 py-2.5 text-sm font-bold"
                style={{ borderColor: c.accentDisplay, background: c.surface, color: c.text }}
              >
                {expanded ? "最初の6作品だけ表示" : "全" + filteredWorks.length + "作品を見る"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
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
          className="fixed inset-0 z-50 flex h-[100dvh] items-center justify-center pb-[calc(1.5rem+env(safe-area-inset-bottom))] pl-[calc(1.5rem+env(safe-area-inset-left))] pr-[calc(1.5rem+env(safe-area-inset-right))] pt-[calc(1.5rem+env(safe-area-inset-top))]"
          style={{ background: c.overlay }}
          onClick={closeModal}
        >
          <div
            className="relative flex max-h-full min-h-0 w-full max-w-3xl flex-col rounded-xl p-3 pb-4"
            style={{
              background: c.surface,
              boxShadow: `0 20px 40px ${c.shadowFloating}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeModal}
              aria-label="閉じる"
              className="pf-cute-focus absolute -right-[16px] -top-[16px] z-10 flex h-[44px] w-[44px] items-center justify-center rounded-full hover:brightness-95"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 font-black shadow-md"
                style={{
                  background: c.action,
                  borderColor: c.actionDisplay,
                  color: c.onAction,
                }}
              >
                ✕
              </span>
            </button>
            {/* 閉じる操作は固定し、低い画面でも画像・詳細を最後まで読めるようにする。 */}
            <div
              role="region"
              aria-label="作品画像と詳細"
              tabIndex={0}
              className="pf-cute-focus min-h-0 overflow-y-auto overscroll-contain rounded-lg [overflow-wrap:anywhere]"
            >
              <div
                className="relative h-[70dvh] w-full overflow-hidden rounded-lg md:h-[76dvh]"
                style={{ background: c.surfaceSubtle }}
              >
                <Image
                  src={selected.image}
                  alt={selected.title}
                  fill
                  sizes="(min-width: 816px) 744px, calc(100vw - 72px)"
                  className="object-contain"
                />
              </div>
              <div className="mt-3 flex flex-col items-start gap-2 px-1 sm:flex-row sm:justify-between">
                <div className="min-w-0 sm:flex-1">
                  <h3 className="font-bold">{selected.title}</h3>
                  {formatProductionMonth(selected.productionMonth) ? (
                    <p className="mt-0.5 text-xs" style={{ color: c.textSoft }}>
                      {formatProductionMonth(selected.productionMonth)}
                    </p>
                  ) : null}
                </div>
                {selectedCollection ||
                publicPortfolioWorkTags(selected.tags).length > 0 ? (
                  <span className="flex max-w-full flex-wrap gap-1 sm:max-w-[50%] sm:justify-end">
                    {selectedCollection ? (
                      <span
                        className="min-w-0 rounded-full px-2 py-1 text-xs font-bold"
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
                        className="min-w-0 rounded-full px-2 py-1 text-xs font-bold"
                        style={{ background: c.surfaceSubtle, color: c.text }}
                      >
                        {tag}
                      </span>
                    ))}
                  </span>
                ) : null}
              </div>
              {variant === "full" && selected.relatedLinks ? (
                <div className="px-1">
                  <PortfolioWorkRelatedLinks
                    workTitle={selected.title}
                    links={selected.relatedLinks}
                  />
                </div>
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
  onSelect: (work: PortfolioWork, collectionName: string, trigger: HTMLButtonElement) => void;
}) {
  const [landscape, setLandscape] = useState(false);
  const palette = placeholderPalettes[index % placeholderPalettes.length];
  const rotate = workRotations[index % workRotations.length];
  const tapeAngle = index % 2 === 0 ? -4 : 3;
  const publicTags = publicPortfolioWorkTags(work.tags);

  return (
    <div
      className={`pf-pin-card ${rotate} relative min-w-0 rounded-xl p-2 pb-3 pt-4 sm:p-3 sm:pb-4 sm:pt-5 ${landscape ? "col-span-2 lg:col-span-3" : ""}`}
      style={{
        background: c.surface,
        boxShadow: `0 10px 20px ${c.shadowSoft}`,
      }}
    >
      <MaskingTape color={collection.color} angle={tapeAngle} />
      <button
        type="button"
        onClick={
          work.image
            ? (event) => onSelect(work, collection.name, event.currentTarget)
            : undefined
        }
        aria-label={work.image ? `${work.title} を拡大表示` : undefined}
        className={`pf-cute-focus relative mb-3 flex w-full items-center justify-center overflow-hidden rounded-lg ${landscape ? "aspect-video lg:max-h-[32rem]" : "aspect-[3/4]"} ${
          work.image ? "cursor-zoom-in" : "cursor-default"
        }`}
        style={{ background: c.surfaceSubtle }}
      >
        {work.image ? (
          <Image
            src={work.image}
            alt={work.title}
            fill
            sizes={landscape
              ? "(min-width: 1024px) 1120px, calc(100vw - 40px)"
              : "(min-width: 1024px) 352px, (min-width: 640px) calc(50vw - 36px), calc(50vw - 44px)"}
            className="object-cover"
            onLoad={(event) => setLandscape(event.currentTarget.naturalWidth > event.currentTarget.naturalHeight)}
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
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full min-w-0 sm:w-auto">
          <p className="truncate text-sm font-bold sm:text-base">{work.title}</p>
          {formatProductionMonth(work.productionMonth) ? (
            <p className="mt-0.5 text-xs" style={{ color: c.textSoft }}>
              {formatProductionMonth(work.productionMonth)}
            </p>
          ) : null}
        </div>
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
