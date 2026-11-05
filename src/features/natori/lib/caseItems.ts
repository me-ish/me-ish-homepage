// 案件の品目の入力ルールと、DB に依存しない計算。
// DB の制約（20261105120000_natori_case_items.sql）と同じ範囲をここでも確かめる。
import { z } from "zod";
import type {
  NatoriCaseItem,
  NatoriCaseItemProgress,
  NatoriCaseItemPublicationPolicy,
} from "../types/caseItems";
import type { NatoriQuoteSnapshotItemV1 } from "../types/quoteSnapshot";

export const NATORI_CASE_ITEM_MAX = 20;
export const NATORI_CASE_ITEM_AMOUNT_MAX = 10_000_000;

export const CASE_ITEM_PROGRESS_LABELS: Record<NatoriCaseItemProgress, string> = {
  not_started: "まだ",
  in_progress: "制作中",
  done: "完成",
};

export const CASE_ITEM_TYPE_LABELS = { icon: "アイコン", sd: "SD", standing: "立ち絵", illustration: "イラスト" } as const;

export const CASE_ITEM_PUBLICATION_LABELS: Record<NatoriCaseItemPublicationPolicy, string> = {
  allowed: "公開してよい",
  delayed: "日付から公開してよい",
  work_private: "作品は公開しない",
  fully_private: "すべて公開しない",
  unknown: "まだ決めていない",
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });

/** 品目の中身（位置と ID 以外）。追加と編集で同じものを使う。 */
export const caseItemFields = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    projectType: z.enum(["icon", "sd", "standing", "illustration"]).nullable(),
    amount: z.number().int().min(0).max(NATORI_CASE_ITEM_AMOUNT_MAX).nullable(),
    dueDate: isoDate.nullable(),
    progress: z.enum(["not_started", "in_progress", "done"]),
    publicationPolicy: z.enum(["allowed", "delayed", "work_private", "fully_private", "unknown"]),
    publicationAllowedFrom: isoDate.nullable(),
    note: z.string().max(2000).nullable(),
  })
  .superRefine((value, ctx) => {
    if ((value.publicationPolicy === "delayed") !== (value.publicationAllowedFrom !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["publicationAllowedFrom"],
        message: "publication_date_mismatch",
      });
    }
  });
export type CaseItemFields = z.infer<typeof caseItemFields>;

export const caseItemCreate = z.strictObject({
  projectId: z.uuid(),
  item: caseItemFields,
});
export const caseItemUpdate = z.strictObject({
  projectId: z.uuid(),
  itemId: z.uuid(),
  /** 読んだときの updatedAt。ほかの画面で変わっていたら保存しない。 */
  expectedUpdatedAt: z.string().min(1),
  item: caseItemFields,
});
export const caseItemDelete = z.strictObject({
  projectId: z.uuid(),
  itemId: z.uuid(),
  expectedUpdatedAt: z.string().min(1),
});

/** 次に足す品目の位置。欠番は詰めず、いちばん後ろに付ける。 */
export function nextCaseItemPosition(items: readonly Pick<NatoriCaseItem, "position">[]): number | null {
  const next = items.reduce((max, item) => Math.max(max, item.position), 0) + 1;
  return next > NATORI_CASE_ITEM_MAX ? null : next;
}

/** 品目の金額の合計。金額の入っていない品目があれば null（合計はまだ決まらない）。 */
export function caseItemsTotal(items: readonly Pick<NatoriCaseItem, "amount">[]): number | null {
  if (!items.length || items.some((item) => item.amount === null)) return null;
  return items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
}

/** いちばん早い納期（品目の納期が1つも無ければ null）。 */
export function caseItemsEarliestDue(items: readonly Pick<NatoriCaseItem, "dueDate">[]): string | null {
  return items.reduce<string | null>((min, item) => (item.dueDate && (!min || item.dueDate < min) ? item.dueDate : min), null);
}

/**
 * この品目の作品を、その日（YYYY-MM-DD、日本時間の日付）にポートフォリオへ出してよいか。
 * 決めていない・作品は非公開・すべて非公開は出さない。日付つきは当日から出す。
 */
export function caseItemPublicationOpen(
  item: Pick<NatoriCaseItem, "publicationPolicy" | "publicationAllowedFrom">,
  today: string,
): boolean {
  if (item.publicationPolicy === "allowed") return true;
  if (item.publicationPolicy === "delayed") return !!item.publicationAllowedFrom && item.publicationAllowedFrom <= today;
  return false;
}

/** 品目をそのまま保存し直すための値（進みだけ変えるときなど）。 */
export function caseItemToFields(item: NatoriCaseItem): CaseItemFields {
  return {
    title: item.title,
    projectType: item.projectType,
    amount: item.amount,
    dueDate: item.dueDate,
    progress: item.progress,
    publicationPolicy: item.publicationPolicy,
    publicationAllowedFrom: item.publicationPolicy === "delayed" ? item.publicationAllowedFrom : null,
    note: item.note,
  };
}

/**
 * 見積の明細を品目から作る。1品目＝1行（数量1・単価＝品目の金額）。
 * 金額の入っていない品目があるときは null（先に品目の金額を決める）。
 */
export function caseItemsToEstimateLines(
  items: readonly NatoriCaseItem[],
  newId: () => string,
): NatoriQuoteSnapshotItemV1[] | null {
  if (items.length === 0 || items.some((item) => item.amount === null)) return null;
  return [...items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: newId(),
      presetItemId: null,
      kind: "manual" as const,
      labelSnapshot: item.title,
      quantity: 1,
      unitAmount: item.amount as number,
      amount: item.amount as number,
      automatic: false,
      sourceFields: [],
      ruleId: null,
      note: null,
    }));
}

/** 日本時間の今日（YYYY-MM-DD）。公開してよい日との比べ合わせに使う。 */
export function tokyoDateISO(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type CaseItemPublicationFacts = Pick<NatoriCaseItem, "publicationPolicy" | "publicationAllowedFrom">;

/**
 * 品目に結ばれた作品を、品目の公開条件が満たされるまで非公開として扱う。
 * items が null（読めなかった）や、結んだ品目が見つからないときも出さない（出しすぎない側に倒す）。
 * 品目に結ばれていない作品は変えない。
 */
export function gateWorksByCaseItems<W extends { caseItemId?: string | null; published: boolean }>(
  works: readonly W[],
  items: ReadonlyMap<string, CaseItemPublicationFacts> | null,
  today: string,
): W[] {
  return works.map((work) => {
    if (!work.caseItemId || !work.published) return work;
    const item = items?.get(work.caseItemId);
    return item && caseItemPublicationOpen(item, today) ? work : { ...work, published: false };
  });
}

/** ポートフォリオ編集で、結んだ品目のせいで作品がいま出るかどうかの一言。 */
export function caseItemPublicationNote(item: CaseItemPublicationFacts | null, today: string): { open: boolean; text: string } {
  if (!item) return { open: false, text: "結んだ品目が見つかりません。結び直すまで、この作品はサイトに出ません。" };
  if (caseItemPublicationOpen(item, today)) return { open: true, text: "品目の公開条件を満たしています。" };
  if (item.publicationPolicy === "delayed" && item.publicationAllowedFrom) {
    const [, m, d] = item.publicationAllowedFrom.split("-");
    return { open: false, text: `${Number(m)}月${Number(d)}日から自動でサイトに出ます。それまでは出ません。` };
  }
  if (item.publicationPolicy === "unknown") return { open: false, text: "品目の公開条件がまだ決まっていないので、サイトに出ません。" };
  return { open: false, text: "品目が「公開しない」なので、サイトに出ません。" };
}
