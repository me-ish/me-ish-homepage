import "server-only";

// features/natori/server/inquiryOrphanService.ts
// ご依頼フォームの資料 object のうち、案件へ紐付かないまま残ったもの
// （P1-05 で未解決だった Storage orphan）の棚卸し。
//
// Storage upload は DB transaction の外で起きるため、RPC の結果が不明な
// まま終わった submission は object だけが残り得る。P1-06 では「結果不明なら
// 保持」を維持したうえで、十分に時間が経過し、かつ台帳に存在しないものだけを
// service role で回収できるようにする。
//
// 安全策:
// - bucket は natori-inquiry-refs 固定
// - path 形式は {projectUuid}/{fileUuid}.webp のみ
// - 既定 24 時間以上経過した object のみ
// - 削除直前に台帳（natori_inquiry_reference_files）を再確認
// - 台帳の読み取りに失敗したら1件も削除しない
// - 1回の削除上限あり
// - secret も storage path も log に出さない
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findLinkedNatoriIntakeReferencePaths } from "@/features/natori/server/intakeRpcAdapter";

const REFERENCE_BUCKET = "natori-inquiry-refs";
const UUID_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const PROJECT_PREFIX_PATTERN = new RegExp(`^${UUID_SEGMENT}$`, "u");
const OBJECT_NAME_PATTERN = new RegExp(`^${UUID_SEGMENT}\\.webp$`, "u");

export const NATORI_ORPHAN_DEFAULT_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const NATORI_ORPHAN_DEFAULT_MAX_DELETIONS = 50;
/** 1回の実行で走査する bucket root entry の上限。 */
export const NATORI_ORPHAN_DEFAULT_MAX_PREFIXES = 200;
/** bucket root を1回の list API で読む件数。 */
export const NATORI_ORPHAN_PREFIX_PAGE_SIZE = 100;
/** offset の上限。運用者入力の暴走を防ぐ。 */
export const NATORI_ORPHAN_MAX_OFFSET = 1_000_000;
/** prefix 配下の object を1回の list API で読む件数（1 submission は最大5件）。 */
const OBJECT_PAGE_SIZE = 100;

export type NatoriInquiryOrphanScanOptions = {
  /** true なら候補の集計だけを行い、1件も削除しない。 */
  dryRun: boolean;
  /**
   * bucket root の raw listing offset。前回実行の nextOffset を渡すと続きから走査する。
   * 省略時は先頭から。
   */
  startOffset?: number;
  minimumAgeMs?: number;
  maxDeletions?: number;
  maxPrefixes?: number;
};

export type NatoriInquiryOrphanScanResult =
  | {
      kind: "ok";
      dryRun: boolean;
      /** 今回の走査開始位置。 */
      startOffset: number;
      /** 今回検査した project UUID prefix の数。 */
      scannedPrefixes: number;
      inspectedObjects: number;
      candidateCount: number;
      deletedCount: number;
      /** 未走査の prefix、または未処理の候補が残っている可能性がある。 */
      truncated: boolean;
      /** 次回の startOffset。走査し切っていれば null。 */
      nextOffset: number | null;
    }
  /** 台帳または Storage を読めなかった。object は保持する。 */
  | { kind: "unavailable" };

type StorageEntry = { name: string; created_at?: string | null };

/** bucket root 上での位置を保持し、途中で打ち切っても同じ prefix から再開できるようにする。 */
type PrefixCursor = { name: string; offset: number };

type PrefixListing =
  | { kind: "ok"; prefixes: PrefixCursor[]; nextOffset: number | null }
  | { kind: "unavailable" };

function isOlderThan(createdAt: string | null | undefined, cutoff: number): boolean {
  if (!createdAt) return false;
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp < cutoff;
}

type StorageBucket = {
  list(
    path: string,
    options: {
      limit: number;
      offset?: number;
      sortBy?: { column: string; order: string };
    }
  ): Promise<{ data: StorageEntry[] | null; error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
};

/**
 * bucket root を offset 付きで複数ページ読み、project UUID prefix だけを集める。
 * 1回の実行で消費する entry 数は maxPrefixes までに制限し、
 * 読み切れなかった場合は次回の開始位置を返す。
 */
async function listProjectPrefixes(
  storage: StorageBucket,
  startOffset: number,
  maxPrefixes: number
): Promise<PrefixListing> {
  const prefixes: PrefixCursor[] = [];
  let offset = startOffset;
  let consumed = 0;

  while (consumed < maxPrefixes) {
    const pageLimit = Math.min(NATORI_ORPHAN_PREFIX_PAGE_SIZE, maxPrefixes - consumed);
    const { data, error } = await storage.list("", {
      limit: pageLimit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) {
      console.error("[natori-inquiry-orphans] prefix listing failed");
      return { kind: "unavailable" };
    }

    data.forEach((entry, index) => {
      if (PROJECT_PREFIX_PATTERN.test(entry.name)) {
        prefixes.push({ name: entry.name, offset: offset + index });
      }
    });
    consumed += data.length;
    offset += data.length;

    // ページが満杯でなければ一覧を末尾まで読み切っている。
    if (data.length < pageLimit) {
      return { kind: "ok", prefixes, nextOffset: null };
    }
  }

  // 予算を使い切り、かつ直前のページは満杯だった。後続が存在する可能性がある。
  return { kind: "ok", prefixes, nextOffset: offset };
}

/**
 * project UUID prefix 単位で orphan 候補を抽出し、dry-run でなければ
 * 台帳未登録のものだけを上限付きで削除する。
 */
export async function scanNatoriInquiryReferenceOrphans(
  options: NatoriInquiryOrphanScanOptions
): Promise<NatoriInquiryOrphanScanResult> {
  const minimumAgeMs = options.minimumAgeMs ?? NATORI_ORPHAN_DEFAULT_MIN_AGE_MS;
  const maxDeletions = options.maxDeletions ?? NATORI_ORPHAN_DEFAULT_MAX_DELETIONS;
  const maxPrefixes = options.maxPrefixes ?? NATORI_ORPHAN_DEFAULT_MAX_PREFIXES;
  const cutoff = Date.now() - minimumAgeMs;

  const startOffset = Math.max(0, Math.trunc(options.startOffset ?? 0));

  const admin = supabaseAdmin();
  const storage = admin.storage.from(REFERENCE_BUCKET) as unknown as StorageBucket;

  const listing = await listProjectPrefixes(storage, startOffset, maxPrefixes);
  if (listing.kind === "unavailable") return { kind: "unavailable" };

  const candidates: string[] = [];
  let inspectedObjects = 0;
  let scannedPrefixes = 0;
  // 削除上限で打ち切った prefix は途中までしか処理していないので、
  // 次回は同じ prefix から再開する。
  let resumeOffset: number | null = null;

  for (const prefix of listing.prefixes) {
    if (resumeOffset !== null) break;
    scannedPrefixes += 1;

    const { data: objects, error: objectError } = await storage.list(prefix.name, {
      limit: OBJECT_PAGE_SIZE,
      sortBy: { column: "name", order: "asc" },
    });
    if (objectError || !objects) {
      console.error("[natori-inquiry-orphans] object listing failed");
      return { kind: "unavailable" };
    }

    for (const entry of objects) {
      if (!OBJECT_NAME_PATTERN.test(entry.name)) continue;
      inspectedObjects += 1;
      if (!isOlderThan(entry.created_at, cutoff)) continue;
      if (candidates.length >= maxDeletions) {
        resumeOffset = prefix.offset;
        break;
      }
      candidates.push(`${prefix.name}/${entry.name}`);
    }
  }

  const truncated = resumeOffset !== null || listing.nextOffset !== null;
  const nextOffset = resumeOffset ?? listing.nextOffset;

  function summarize(candidateCount: number, deletedCount: number) {
    return {
      kind: "ok" as const,
      dryRun: options.dryRun,
      startOffset,
      scannedPrefixes,
      inspectedObjects,
      candidateCount,
      deletedCount,
      truncated,
      nextOffset,
    };
  }

  if (candidates.length === 0) return summarize(0, 0);

  // 削除直前に台帳を再確認する。読めなかった場合は1件も削除しない。
  const linked = await findLinkedNatoriIntakeReferencePaths(candidates);
  if (linked.kind === "unknown") return { kind: "unavailable" };
  const linkedPaths = new Set(linked.linkedPaths);
  const orphans = candidates.filter((path) => !linkedPaths.has(path));

  if (options.dryRun || orphans.length === 0) return summarize(orphans.length, 0);

  const { error: removeError } = await storage.remove(orphans);
  if (removeError) {
    console.error("[natori-inquiry-orphans] removal failed");
    return { kind: "unavailable" };
  }

  return summarize(orphans.length, orphans.length);
}
