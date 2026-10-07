"use client";

// features/natori/components/portfolio/PortfolioGallery.tsx
// ご依頼実績。マスキングテープで貼ったポラロイド風のカードをまっすぐに並べ、先頭の1枚は「ピックアップ」として大きく見せる。
// 画像はX(Twitter)の縦長表示に近い 3:4 で見せ、クリックでモーダル拡大表示（前後の作品にも移れる）。
import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ChevronUp, X } from "lucide-react";
import {
  placeholderPalettes,
  portfolioColors as c,
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
import { fontEnStyle } from "./portfolioFonts";
import PortfolioWorkRelatedLinks, { relatedLinksHeading } from "./PortfolioWorkRelatedLinks";

const GALLERY_PREVIEW_LIMIT = 6;

function collectionLabel(name: string): string {
  return name === "卵商品" ? "つなぐ 卵商品" : name;
}

function formatProductionMonth(value?: string | null): string | null {
  if (!value) return null;
  const [year, month] = value.split("-");
  const monthNumber = Number(month);
  if (!year || !Number.isInteger(monthNumber)) return null;
  return `${year}年${monthNumber}月制作`;
}

/** 制作月・カテゴリ・公開タグを「・」区切りの1行にする（色の付いた札は使わず、絵より目立たせない）。 */
function workMeta(work: PortfolioWork, collection: PortfolioCollection): string[] {
  return [
    formatProductionMonth(work.productionMonth),
    collectionLabel(collection.name),
    ...publicPortfolioWorkTags(work.tags),
  ].filter((item): item is string => Boolean(item));
}

function WorkMetaLine({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <p className="mt-0.5 text-[13px] leading-snug" style={{ color: c.textSoft }}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`}>
          {index > 0 ? " " : null}
          <span className="whitespace-nowrap">
            {index > 0 ? <span aria-hidden="true">· </span> : null}
            <span>{item}</span>
          </span>
        </span>
      ))}
    </p>
  );
}

function MaskingTape({ color, angle, large }: { color: string; angle: number; large?: boolean }) {
  return (
    <span
      className={`absolute left-1/2 z-10 rounded-[2px] ${
        large ? "-top-3.5 h-6 w-20 sm:h-7 sm:w-28" : "-top-3 h-5 w-12 sm:w-16"
      }`}
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
  consultation,
  intro,
}: {
  works: PortfolioWork[];
  collections: PortfolioCollection[];
  variant?: PortfolioVariant;
  /** 見出しの下に出す紹介文（編集画面の「ギャラリーの紹介文」）。空なら出さない */
  intro?: string;
  /** 画像なし作品のプレースホルダーをキャラSVGではなくベタ塗りにする（デモ用） */
  flatPlaceholders?: boolean;
  /**
   * 拡大表示に「この雰囲気で相談する」を出すときの相談フォーム。query は「&structured=1」のような追加分。
   * 作品集（showcase）では渡されても出さない。
   */
  consultation?: { contactPath: string; query: string };
}) {
  const [selected, setSelected] = useState<PortfolioWork | null>(null);
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const detailsRef = useRef<HTMLDivElement | null>(null);
  // ご依頼者様・使用例の帯を畳んだ作品。畳むのはその作品だけで、ほかの作品では帯を開いて見せる。
  const [collapsedWorkId, setCollapsedWorkId] = useState<string | null>(null);
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
  const workCountByCollectionId = new Map<string | null, number>([
    [null, publishedWorks.length],
    ...groups.map((group): [string, number] => [group.collection.id, group.works.length]),
  ]);

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

  const modalOpen = Boolean(selected?.image);

  // モーダル表示中はフォーカスを内部に保ち、Esc で閉じ、背景のスクロールを止める。
  // close 後は作品カードへフォーカスを戻す（前後に移った場合は、最後に見ていた作品のカード）。
  useEffect(() => {
    if (!modalOpen) return;
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
      modalTriggerRef.current?.focus();
    };
  }, [closeModal, modalOpen]);

  // 前後の作品に移ったら、詳細を先頭から読めるようにする。
  useEffect(() => {
    if (detailsRef.current) detailsRef.current.scrollTop = 0;
  }, [selected?.id]);

  const activeCollection = groups.find((group) => group.collection.id === activeCollectionId);
  const filteredWorks = activeCollection
    ? orderedWorks.filter(
        ({ collection }) => collection.id === activeCollection.collection.id,
      )
    : orderedWorks;
  const shownWorks = expanded ? filteredWorks : filteredWorks.slice(0, GALLERY_PREVIEW_LIMIT);

  // 拡大表示の前後移動は、いま選んでいるカテゴリの画像付き作品を表示順に巡る（一覧に未表示の作品も含む）。
  const viewableWorks = filteredWorks.filter(({ work }) => Boolean(work.image));
  const selectedPosition = selected
    ? viewableWorks.findIndex(({ work }) => work.id === selected.id)
    : -1;
  const selectedEntry = selectedPosition >= 0 ? viewableWorks[selectedPosition] : null;
  const canBrowse = selectedPosition >= 0 && viewableWorks.length > 1;
  // ご依頼者様・使用例は絵の下だとスクロールしないと気付きにくいので、絵の下部に帯で重ねる。
  const relatedHeading = variant === "full" && selected ? relatedLinksHeading(selected.relatedLinks) : null;
  const relatedCollapsed = collapsedWorkId === selected?.id;

  const showAdjacentWork = (offset: 1 | -1) => {
    if (!canBrowse) return;
    const next =
      viewableWorks[(selectedPosition + offset + viewableWorks.length) % viewableWorks.length].work;
    // 一覧に出ている作品なら、閉じたときにそのカードへフォーカスを戻す。
    const card = Array.from(
      resultsRef.current?.querySelectorAll<HTMLButtonElement>("button[data-work-id]") ?? [],
    ).find((button) => button.dataset.workId === next.id);
    if (card) modalTriggerRef.current = card;
    setSelected(next);
  };

  const onDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canBrowse || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    showAdjacentWork(event.key === "ArrowRight" ? 1 : -1);
  };

  const consultationHref =
    variant === "full" && consultation && selected
      ? `${consultation.contactPath}?mode=consultation&work=${encodeURIComponent(selected.id)}${consultation.query}`
      : null;

  const navButtonClassName =
    "pf-cute-focus absolute top-[calc(0.75rem+35dvh)] z-10 flex h-[44px] w-[44px] -translate-y-1/2 items-center justify-center rounded-full md:top-[calc(0.75rem+38dvh)]";

  return (
    <section id="gallery" className="mx-auto max-w-6xl px-5 py-16">
      <div className="mb-10">
        <h2 className="text-2xl font-black md:text-3xl">
          ご依頼実績 <span style={{ color: c.highlight }}>°˖✧</span>
        </h2>
        {intro?.trim() ? (
          <p
            className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-relaxed md:text-base"
            style={{ color: c.textSoft }}
          >
            {intro.trim()}
          </p>
        ) : null}
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
                style={
                  collection.id === (activeCollection?.collection.id ?? null)
                    ? { background: c.text, borderColor: c.text, color: c.onAction }
                    : { background: c.surface, borderColor: c.borderSubtle, color: c.text }
                }
              >
                  {collectionLabel(collection.name)}
                  {/* 件数は見た目の補足。読み上げは下の状況表示で伝える。 */}
                  <span aria-hidden="true" className="ml-1.5 text-[13px] font-semibold opacity-75" style={fontEnStyle}>
                    {workCountByCollectionId.get(collection.id) ?? 0}
                  </span>
              </button>
            ))}
          </div>
          {/* 表示件数と拡大の案内は読み上げ用に残し、見た目は件数入りのカテゴリとボタンに任せる。 */}
          <div className="sr-only">
            <p role="status">
              {activeCollection ? collectionLabel(activeCollection.collection.name) : "すべての作品"}：{filteredWorks.length}作品中{shownWorks.length}作品を表示
            </p>
            {shownWorks.some(({ work }) => work.image) ? (
              <p>画像をタップ・クリックで拡大できます。</p>
            ) : null}
          </div>
          {activeCollection?.collection.description ? (
            <p className="mb-6 text-sm" style={{ color: c.textSoft }}>{activeCollection.collection.description}</p>
          ) : null}
          <div ref={resultsRef} id="portfolio-gallery-results" className="grid grid-cols-2 gap-x-4 gap-y-8 pt-2 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-6">
            {shownWorks.map(({ work, collection }, index) => (
              <PortfolioWorkCard
                key={work.id}
                work={work}
                index={index}
                collection={collection}
                pickup={index === 0}
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
                style={{ borderColor: c.action, background: c.surface, color: c.text }}
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

      {/* 拡大表示モーダル。背景クリック / ×ボタン / Esc で閉じる。←→ と左右のボタンで前後の作品へ */}
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
          onKeyDown={onDialogKeyDown}
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
            {/* 前後の作品。絵の左右の縁にかけ、顔まわりにはかからない位置に置く。 */}
            {canBrowse ? (
              <>
                <button
                  type="button"
                  onClick={() => showAdjacentWork(-1)}
                  aria-label="前の作品を表示"
                  className={`${navButtonClassName} -left-[12px] sm:-left-[20px]`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full border shadow-md"
                    style={{ background: c.surface, borderColor: c.borderSubtle, color: c.text }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => showAdjacentWork(1)}
                  aria-label="次の作品を表示"
                  className={`${navButtonClassName} -right-[12px] sm:-right-[20px]`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full border shadow-md"
                    style={{ background: c.surface, borderColor: c.borderSubtle, color: c.text }}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </span>
                </button>
              </>
            ) : null}
            {/* 閉じる操作は固定し、低い画面でも画像・詳細を最後まで読めるようにする。 */}
            <div
              ref={detailsRef}
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
                {canBrowse ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-[13px] font-semibold"
                    style={{ ...fontEnStyle, background: c.pageTranslucent, color: c.text }}
                  >
                    {selectedPosition + 1} / {viewableWorks.length}
                  </span>
                ) : null}
                {relatedHeading && selected.relatedLinks ? (
                  relatedCollapsed ? (
                    <button
                      type="button"
                      onClick={() => setCollapsedWorkId(null)}
                      aria-expanded="false"
                      className="pf-cute-focus absolute bottom-2 left-1/2 inline-flex min-h-[40px] max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-1 rounded-full border px-3.5 py-1.5 text-[13px] font-bold shadow-md"
                      style={{ background: c.pageTranslucent, borderColor: c.action, color: c.text }}
                    >
                      <span className="truncate">{relatedHeading}</span>
                      <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                  ) : (
                    <div
                      className="absolute inset-x-0 bottom-0 max-h-[55%] overflow-y-auto overscroll-contain px-3 pb-3 pt-2.5 backdrop-blur-sm"
                      style={{ background: "rgba(255,254,254,0.9)", boxShadow: `0 -6px 16px ${c.shadowSoft}` }}
                    >
                      <button
                        type="button"
                        onClick={() => setCollapsedWorkId(selected.id)}
                        aria-expanded="true"
                        aria-label={`${relatedHeading}を畳んで絵を全部見る`}
                        className="pf-cute-focus float-right -mr-1 -mt-1 ml-2 flex h-9 w-9 items-center justify-center rounded-full"
                        style={{ color: c.textSoft }}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                      <PortfolioWorkRelatedLinks
                        workTitle={selected.title}
                        links={selected.relatedLinks}
                        overlay
                      />
                    </div>
                  )
                ) : null}
              </div>
              <div className="mt-3 px-1">
                {/* 前後に移ったときに、新しい作品名と位置を読み上げる（開いた時点の内容は読み上げない）。 */}
                {canBrowse ? (
                  <p className="sr-only" aria-live="polite">
                    {selected.title}（{selectedPosition + 1}/{viewableWorks.length}作品目）
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="font-bold">{selected.title}</h3>
                    <WorkMetaLine
                      items={workMeta(selected, selectedEntry?.collection ?? unassignedCollection)}
                    />
                  </div>
                  {consultationHref ? (
                    <a
                      href={consultationHref}
                      onClick={() => trackNatoriPageEvent("portfolio_primary_cta_click", "gallery")}
                      className="pf-cute-focus inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border-2 px-5 py-2 text-[13px] font-bold sm:text-sm"
                      style={{ borderColor: c.actionDisplay, color: c.text, background: c.surface }}
                    >
                      この雰囲気で相談する
                    </a>
                  ) : null}
                </div>
              </div>
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
  pickup,
  flatPlaceholder,
  onSelect,
}: {
  work: PortfolioWork;
  index: number;
  collection: PortfolioCollection;
  /** 一覧の先頭。大きく見せて「PICK UP」を添える */
  pickup: boolean;
  flatPlaceholder?: boolean;
  onSelect: (work: PortfolioWork, collectionName: string, trigger: HTMLButtonElement) => void;
}) {
  const [landscape, setLandscape] = useState(false);
  const palette = placeholderPalettes[index % placeholderPalettes.length];
  const tapeAngle = index % 2 === 0 ? -2 : 2;
  // 横長の作品はもともと幅広のカードなので、先頭でも大きさは変えない。
  const featured = pickup && !landscape;

  return (
    <div
      className={`pf-pin-card relative min-w-0 rounded-xl p-1.5 pb-2.5 pt-3.5 sm:p-2.5 sm:pb-3 sm:pt-4 ${
        landscape
          ? "col-span-2 lg:col-span-3"
          : featured
            ? "col-span-2 lg:col-span-4 lg:row-span-2 lg:flex lg:flex-col"
            : "lg:col-span-2"
      }`}
      style={{
        background: c.surface,
        boxShadow: `0 10px 20px ${c.shadowSoft}`,
      }}
    >
      <MaskingTape color={collection.color} angle={tapeAngle} large={pickup} />
      {pickup ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-6 z-10 rounded-full px-3 py-1 text-[13px] font-semibold tracking-[0.16em] sm:left-5 sm:top-7"
          style={{ ...fontEnStyle, background: c.pageTranslucent, color: c.actionTextSmall }}
        >
          PICK UP
        </span>
      ) : null}
      <button
        type="button"
        data-work-id={work.id}
        onClick={
          work.image
            ? (event) => onSelect(work, collection.name, event.currentTarget)
            : undefined
        }
        aria-label={work.image ? `${work.title} を拡大表示` : undefined}
        className={`pf-cute-focus relative mb-2 flex w-full items-center justify-center overflow-hidden rounded-lg ${
          landscape
            ? "aspect-video lg:max-h-[32rem]"
            : featured
              ? "aspect-[4/5] sm:aspect-auto sm:h-[30rem] lg:h-auto lg:min-h-[30rem] lg:flex-1"
              : "aspect-[3/4]"
        } ${work.image ? "cursor-zoom-in" : "cursor-default"}`}
        style={{ background: c.surfaceSubtle }}
      >
        {work.image ? (
          <Image
            src={work.image}
            alt={work.title}
            fill
            sizes={landscape
              ? "(min-width: 1024px) 540px, calc(100vw - 40px)"
              : featured
                ? "(min-width: 1024px) 730px, calc(100vw - 40px)"
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
            size={featured ? 160 : 110}
            skin={palette.skin}
            hair={palette.hair}
            accent={palette.accent}
          />
        )}
      </button>
      <div className="min-w-0 px-0.5">
        <p className={`truncate font-bold ${featured ? "text-base sm:text-lg" : "text-sm sm:text-base"}`}>
          {work.title}
        </p>
        <WorkMetaLine items={workMeta(work, collection)} />
      </div>
    </div>
  );
}
