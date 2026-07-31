// Storage orphan 棚卸しのテスト。
// dry-run 既定、24時間の下限、台帳再確認、削除上限、読み取り失敗時の保持を固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockList, mockRemove, mockFrom, mockFindLinked } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockRemove: vi.fn(),
  mockFrom: vi.fn(),
  mockFindLinked: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    storage: { from: (...args: unknown[]) => mockFrom(...args) },
  }),
}));

vi.mock("@/features/natori/server/intakeRpcAdapter", () => ({
  findLinkedNatoriIntakeReferencePaths: (...args: unknown[]) => mockFindLinked(...args),
}));

import { scanNatoriInquiryReferenceOrphans } from "@/features/natori/server/inquiryOrphanService";

const PROJECT_A = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";
const PROJECT_B = "ba24cb61-b3ff-4584-87f9-d549bc3af77d";
const FILE_A = "b65e16de-13c8-4bf6-a830-87f466815dba.webp";
const FILE_B = "c0d6b5f7-6f1c-4a53-9d1c-3f9b6d0a7c21.webp";

const OLD = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
const RECENT = new Date(Date.now() - 60 * 60 * 1000).toISOString();

function stubStorage(listing: Record<string, Array<{ name: string; created_at?: string }>>) {
  mockList.mockImplementation(async (prefix: string) => ({
    data: listing[prefix] ?? [],
    error: null,
  }));
  mockFrom.mockReturnValue({ list: mockList, remove: mockRemove });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRemove.mockResolvedValue({ error: null });
  mockFindLinked.mockResolvedValue({ kind: "ok", linkedPaths: [] });
});

describe("scanNatoriInquiryReferenceOrphans", () => {
  it("natori-inquiry-refs bucket に固定する", async () => {
    stubStorage({ "": [] });
    await scanNatoriInquiryReferenceOrphans({ dryRun: true });
    expect(mockFrom).toHaveBeenCalledWith("natori-inquiry-refs");
  });

  it("dry-run では候補を数えるだけで削除しない", async () => {
    stubStorage({
      "": [{ name: PROJECT_A }],
      [PROJECT_A]: [{ name: FILE_A, created_at: OLD }],
    });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: true });
    expect(result).toMatchObject({ kind: "ok", dryRun: true, candidateCount: 1, deletedCount: 0 });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("24時間未満の object は候補にしない", async () => {
    stubStorage({
      "": [{ name: PROJECT_A }],
      [PROJECT_A]: [{ name: FILE_A, created_at: RECENT }],
    });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: false });
    expect(result).toMatchObject({ candidateCount: 0, deletedCount: 0 });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("台帳に載っている object は削除しない", async () => {
    stubStorage({
      "": [{ name: PROJECT_A }],
      [PROJECT_A]: [
        { name: FILE_A, created_at: OLD },
        { name: FILE_B, created_at: OLD },
      ],
    });
    mockFindLinked.mockResolvedValue({
      kind: "ok",
      linkedPaths: [`${PROJECT_A}/${FILE_A}`],
    });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: false });
    expect(mockRemove).toHaveBeenCalledWith([`${PROJECT_A}/${FILE_B}`]);
    expect(result).toMatchObject({ deletedCount: 1 });
  });

  it("台帳を読めなければ1件も削除しない", async () => {
    stubStorage({
      "": [{ name: PROJECT_A }],
      [PROJECT_A]: [{ name: FILE_A, created_at: OLD }],
    });
    mockFindLinked.mockResolvedValue({ kind: "unknown" });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: false });
    expect(result).toEqual({ kind: "unavailable" });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("Storage 一覧が失敗したら object を保持する", async () => {
    mockList.mockResolvedValue({ data: null, error: { message: "boom" } });
    mockFrom.mockReturnValue({ list: mockList, remove: mockRemove });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: false });
    expect(result).toEqual({ kind: "unavailable" });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("project UUID prefix と {uuid}.webp 以外は対象にしない", async () => {
    stubStorage({
      "": [{ name: PROJECT_A }, { name: "images" }, { name: "../etc" }],
      [PROJECT_A]: [
        { name: FILE_A, created_at: OLD },
        { name: "notes.txt", created_at: OLD },
        { name: "arbitrary.webp", created_at: OLD },
      ],
    });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: true });
    expect(result).toMatchObject({ scannedPrefixes: 1, inspectedObjects: 1, candidateCount: 1 });
  });

  it("一度の削除上限を超えたら truncated として打ち切る", async () => {
    stubStorage({
      "": [{ name: PROJECT_A }, { name: PROJECT_B }],
      [PROJECT_A]: [
        { name: FILE_A, created_at: OLD },
        { name: FILE_B, created_at: OLD },
      ],
      [PROJECT_B]: [{ name: FILE_A, created_at: OLD }],
    });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: false, maxDeletions: 1 });
    expect(result).toMatchObject({ deletedCount: 1, truncated: true });
    expect(mockRemove).toHaveBeenCalledWith([`${PROJECT_A}/${FILE_A}`]);
  });

  it("削除に失敗したら unavailable を返す", async () => {
    stubStorage({
      "": [{ name: PROJECT_A }],
      [PROJECT_A]: [{ name: FILE_A, created_at: OLD }],
    });
    mockRemove.mockResolvedValue({ error: { message: "denied" } });
    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: false });
    expect(result).toEqual({ kind: "unavailable" });
  });
});
