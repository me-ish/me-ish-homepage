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
export const NATORI_ORPHAN_DEFAULT_MAX_PREFIXES = 200;

export type NatoriInquiryOrphanScanOptions = {
  /** true なら候補の集計だけを行い、1件も削除しない。 */
  dryRun: boolean;
  minimumAgeMs?: number;
  maxDeletions?: number;
  maxPrefixes?: number;
};

export type NatoriInquiryOrphanScanResult =
  | {
      kind: "ok";
      dryRun: boolean;
      scannedPrefixes: number;
      inspectedObjects: number;
      candidateCount: number;
      deletedCount: number;
      /** 削除上限に達し、まだ候補が残っている可能性がある。 */
      truncated: boolean;
    }
  /** 台帳または Storage を読めなかった。object は保持する。 */
  | { kind: "unavailable" };

type StorageEntry = { name: string; created_at?: string | null };

function isOlderThan(createdAt: string | null | undefined, cutoff: number): boolean {
  if (!createdAt) return false;
  const timestamp = Date.parse(createdAt);
  return Number.isFinite(timestamp) && timestamp < cutoff;
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

  const admin = supabaseAdmin();
  const storage = admin.storage.from(REFERENCE_BUCKET);

  const { data: prefixes, error: prefixError } = await storage.list("", {
    limit: maxPrefixes,
    sortBy: { column: "name", order: "asc" },
  });
  if (prefixError || !prefixes) {
    console.error("[natori-inquiry-orphans] prefix listing failed");
    return { kind: "unavailable" };
  }

  const projectPrefixes = prefixes
    .map((entry) => entry.name)
    .filter((name) => PROJECT_PREFIX_PATTERN.test(name));

  const candidates: string[] = [];
  let inspectedObjects = 0;
  let truncated = false;

  for (const prefix of projectPrefixes) {
    const { data: objects, error: objectError } = await storage.list(prefix, {
      limit: 100,
      sortBy: { column: "name", order: "asc" },
    });
    if (objectError || !objects) {
      console.error("[natori-inquiry-orphans] object listing failed");
      return { kind: "unavailable" };
    }
    for (const entry of objects as StorageEntry[]) {
      if (!OBJECT_NAME_PATTERN.test(entry.name)) continue;
      inspectedObjects += 1;
      if (!isOlderThan(entry.created_at, cutoff)) continue;
      if (candidates.length >= maxDeletions) {
        truncated = true;
        break;
      }
      candidates.push(`${prefix}/${entry.name}`);
    }
    if (truncated) break;
  }

  if (candidates.length === 0) {
    return {
      kind: "ok",
      dryRun: options.dryRun,
      scannedPrefixes: projectPrefixes.length,
      inspectedObjects,
      candidateCount: 0,
      deletedCount: 0,
      truncated,
    };
  }

  // 削除直前に台帳を再確認する。読めなかった場合は1件も削除しない。
  const linked = await findLinkedNatoriIntakeReferencePaths(candidates);
  if (linked.kind === "unknown") return { kind: "unavailable" };
  const linkedPaths = new Set(linked.linkedPaths);
  const orphans = candidates.filter((path) => !linkedPaths.has(path));

  if (options.dryRun || orphans.length === 0) {
    return {
      kind: "ok",
      dryRun: options.dryRun,
      scannedPrefixes: projectPrefixes.length,
      inspectedObjects,
      candidateCount: orphans.length,
      deletedCount: 0,
      truncated,
    };
  }

  const { error: removeError } = await storage.remove(orphans);
  if (removeError) {
    console.error("[natori-inquiry-orphans] removal failed");
    return { kind: "unavailable" };
  }

  return {
    kind: "ok",
    dryRun: false,
    scannedPrefixes: projectPrefixes.length,
    inspectedObjects,
    candidateCount: orphans.length,
    deletedCount: orphans.length,
    truncated,
  };
}
