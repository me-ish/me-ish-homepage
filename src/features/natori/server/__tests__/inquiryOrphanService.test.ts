// Storage orphan 棚卸しのテスト。
// dry-run 既定、24時間の下限、台帳再確認、削除上限、読み取り失敗時の保持を固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockList, mockRemove, mockFrom, mockFindLinked, mockOperations, mockCleanupScope } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockRemove: vi.fn(),
  mockFrom: vi.fn(),
  mockFindLinked: vi.fn(),
  mockOperations: vi.fn(),
  mockCleanupScope: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ in: mockOperations }) }),
    rpc: (...args: unknown[]) => mockCleanupScope(...args),
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

type Entry = { name: string; created_at?: string };

/**
 * bucket root は offset/limit で slice し、実際の Storage list と同じ
 * pagination 挙動を再現する。prefix 配下はそのまま返す。
 */
function stubStorage(listing: Record<string, Entry[]>) {
  mockList.mockImplementation(
    async (prefix: string, options: { limit: number; offset?: number }) => {
      const entries = listing[prefix] ?? [];
      if (prefix !== "") return { data: entries, error: null };
      const offset = options.offset ?? 0;
      return { data: entries.slice(offset, offset + options.limit), error: null };
    }
  );
  mockFrom.mockReturnValue({ list: mockList, remove: mockRemove });
}

/** root に n 件の project prefix を並べ、各 prefix に古い object 1件を置く。 */
function manyPrefixes(count: number): Record<string, Entry[]> {
  const listing: Record<string, Entry[]> = { "": [] };
  for (let i = 0; i < count; i++) {
    const name = `${i.toString(16).padStart(8, "0")}-e0a3-4f32-b846-a0d8c6bbf44c`;
    listing[""].push({ name });
    listing[name] = [{ name: FILE_A, created_at: OLD }];
  }
  return listing;
}

function rootListCalls() {
  return mockList.mock.calls.filter((call) => call[0] === "");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRemove.mockResolvedValue({ error: null });
  mockFindLinked.mockResolvedValue({ kind: "ok", linkedPaths: [] });
  mockOperations.mockResolvedValue({ data: [], error: null });
  mockCleanupScope.mockResolvedValue({ data: [], error: null });
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
    expect(result).toMatchObject({
      kind: "ok",
      dryRun: true,
      candidateCount: 1,
      deletedCount: 0,
      startOffset: 0,
    });
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

describe("prefix pagination", () => {
  it("prefix が上限以下なら nextOffset=null で truncated しない", async () => {
    stubStorage(manyPrefixes(150));
    const result = await scanNatoriInquiryReferenceOrphans({
      dryRun: true,
      maxDeletions: 500,
    });
    expect(result).toMatchObject({
      kind: "ok",
      scannedPrefixes: 150,
      candidateCount: 150,
      truncated: false,
      nextOffset: null,
    });
    // 100件ページ × 2（2ページ目は満杯でないので打ち切り）
    expect(rootListCalls()).toHaveLength(2);
    expect(rootListCalls()[1][1]).toMatchObject({ offset: 100 });
  });

  it("prefix が上限件数ちょうどなら truncated=true と nextOffset を返す", async () => {
    stubStorage(manyPrefixes(500));
    const result = await scanNatoriInquiryReferenceOrphans({
      dryRun: true,
      maxDeletions: 500,
    });
    expect(result).toMatchObject({
      kind: "ok",
      scannedPrefixes: 200,
      truncated: true,
      nextOffset: 200,
    });
  });

  it("nextOffset を渡すと続きの page から list する", async () => {
    stubStorage(manyPrefixes(500));
    const result = await scanNatoriInquiryReferenceOrphans({
      dryRun: true,
      startOffset: 200,
      maxDeletions: 500,
    });
    expect(result).toMatchObject({
      kind: "ok",
      startOffset: 200,
      scannedPrefixes: 200,
      truncated: true,
      nextOffset: 400,
    });
    expect(rootListCalls()[0][1]).toMatchObject({ offset: 200 });
  });

  it("2ページ目以降の orphan も候補にできる", async () => {
    const listing = manyPrefixes(120);
    const latePrefix = listing[""][119].name;
    stubStorage(listing);

    const result = await scanNatoriInquiryReferenceOrphans({
      dryRun: false,
      maxDeletions: 500,
    });
    expect(result).toMatchObject({ kind: "ok", deletedCount: 120 });
    expect(mockRemove.mock.calls[0][0]).toContain(`${latePrefix}/${FILE_A}`);
  });

  it("最終ページの list error でも1件も削除しない", async () => {
    const listing = manyPrefixes(150);
    mockFrom.mockReturnValue({ list: mockList, remove: mockRemove });
    mockList.mockImplementation(
      async (prefix: string, options: { limit: number; offset?: number }) => {
        if (prefix === "") {
          const offset = options.offset ?? 0;
          if (offset > 0) return { data: null, error: { message: "boom" } };
          return { data: listing[""].slice(offset, offset + options.limit), error: null };
        }
        return { data: listing[prefix] ?? [], error: null };
      }
    );

    const result = await scanNatoriInquiryReferenceOrphans({ dryRun: false });
    expect(result).toEqual({ kind: "unavailable" });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("dry-run では pagination しても削除しない", async () => {
    stubStorage(manyPrefixes(500));
    const result = await scanNatoriInquiryReferenceOrphans({
      dryRun: true,
      maxDeletions: 500,
    });
    expect(result).toMatchObject({ dryRun: true, deletedCount: 0, truncated: true });
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("2ページ目でも台帳に載っている path は削除しない", async () => {
    const listing = manyPrefixes(120);
    const latePrefix = listing[""][119].name;
    stubStorage(listing);
    mockFindLinked.mockResolvedValue({
      kind: "ok",
      linkedPaths: [`${latePrefix}/${FILE_A}`],
    });

    const result = await scanNatoriInquiryReferenceOrphans({
      dryRun: false,
      maxDeletions: 500,
    });
    expect(result).toMatchObject({ deletedCount: 119 });
    expect(mockRemove.mock.calls[0][0]).not.toContain(`${latePrefix}/${FILE_A}`);
  });

  it("削除上限で打ち切ったら、その prefix から再開できる offset を返す", async () => {
    stubStorage(manyPrefixes(10));
    const result = await scanNatoriInquiryReferenceOrphans({
      dryRun: false,
      maxDeletions: 3,
    });
    // 4件目に到達した prefix（index 3）から再開する
    expect(result).toMatchObject({
      kind: "ok",
      candidateCount: 3,
      deletedCount: 3,
      truncated: true,
      nextOffset: 3,
    });
  });
});

describe("intake operation orphan fence",()=>{
 it("preserves processing prefixes while existing legacy orphan handling remains unchanged",async()=>{
  stubStorage({"": [{name:PROJECT_A},{name:PROJECT_B}],[PROJECT_A]:[{name:FILE_A,created_at:OLD}],[PROJECT_B]:[{name:FILE_B,created_at:OLD}]});
  mockOperations.mockResolvedValue({data:[{project_id:PROJECT_A,status:"processing"}],error:null});
  const result=await scanNatoriInquiryReferenceOrphans({dryRun:false});expect(result).toMatchObject({deletedCount:1});
  expect(mockRemove).toHaveBeenCalledWith([`${PROJECT_B}/${FILE_B}`]);
 });
 it("refuses broad cleanup when operation ledger lookup fails",async()=>{
  stubStorage({"": [{name:PROJECT_A}],[PROJECT_A]:[{name:FILE_A,created_at:OLD}]});mockOperations.mockResolvedValue({data:null,error:{code:"unknown"}});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toEqual({kind:"unavailable"});expect(mockRemove).not.toHaveBeenCalled();
 });
});

describe("durable failed intake cleanup retry",()=>{
 const failed={owner_id:"4e6b1562-4d57-4c11-a4cb-38164cb6a5c3",operation_id:"2a51e8b4-7944-4e4f-8c81-3bd18168d037",request_hash:"a".repeat(64),project_id:PROJECT_A,status:"failed"};
 const path=`${PROJECT_A}/${FILE_A}`;
 function failedListing(){stubStorage({"": [{name:PROJECT_A}],[PROJECT_A]:[{name:FILE_A,created_at:OLD},{name:FILE_B,created_at:OLD}]});mockOperations.mockResolvedValue({data:[failed],error:null});mockCleanupScope.mockResolvedValue({data:[path],error:null});}
 it("retries an exact failed path after Storage removal failure without releasing the tombstone",async()=>{
  failedListing();mockRemove.mockResolvedValueOnce({error:{code:"retry"}}).mockResolvedValueOnce({error:null});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toEqual({kind:"unavailable"});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toMatchObject({deletedCount:1});
  expect(mockRemove.mock.calls.map(call=>call[0])).toEqual([[path],[path]]);
  expect(mockCleanupScope).toHaveBeenCalledTimes(2);
  expect(mockCleanupScope).toHaveBeenLastCalledWith("natori_intake_cleanup_scope_v1",{p_owner_id:failed.owner_id,p_operation_id:failed.operation_id,p_request_hash:failed.request_hash});
 });
 it("catches a failed object's late arrival on the next eligible scan",async()=>{
  stubStorage({"": [{name:PROJECT_A}],[PROJECT_A]:[]});mockOperations.mockResolvedValue({data:[failed],error:null});mockCleanupScope.mockResolvedValue({data:[path],error:null});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toMatchObject({deletedCount:0});
  stubStorage({"": [{name:PROJECT_A}],[PROJECT_A]:[{name:FILE_A,created_at:OLD}]});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toMatchObject({deletedCount:1});expect(mockRemove).toHaveBeenCalledWith([path]);
 });
 it("preserves unknown and completed operation prefixes irrespective of age",async()=>{
  for(const status of ["processing","needs_review","completed"]){failedListing();mockOperations.mockResolvedValue({data:[{...failed,status}],error:null});
   expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toMatchObject({deletedCount:0});}
  expect(mockCleanupScope).not.toHaveBeenCalled();expect(mockRemove).not.toHaveBeenCalled();
 });
 it("never removes a committed reference or an unlisted path from the failed prefix",async()=>{
  failedListing();mockFindLinked.mockResolvedValue({kind:"ok",linkedPaths:[path]});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toMatchObject({deletedCount:0});expect(mockRemove).not.toHaveBeenCalled();
 });
 it("fails closed if exact cleanup scope cannot be checked",async()=>{
  failedListing();mockCleanupScope.mockResolvedValue({data:null,error:{code:"unknown"}});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toEqual({kind:"unavailable"});expect(mockRemove).not.toHaveBeenCalled();
 });
 it("fails closed on a cleanup path outside that operation project",async()=>{
  failedListing();mockCleanupScope.mockResolvedValue({data:[`${PROJECT_B}/${FILE_A}`],error:null});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toEqual({kind:"unavailable"});expect(mockRemove).not.toHaveBeenCalled();
 });
 it("honors dry-run, age and deletion bounds for failed operation paths",async()=>{
  failedListing();expect(await scanNatoriInquiryReferenceOrphans({dryRun:true,maxDeletions:1})).toMatchObject({candidateCount:1,deletedCount:0,truncated:true});expect(mockRemove).not.toHaveBeenCalled();
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false,maxDeletions:1})).toMatchObject({deletedCount:1,truncated:true});expect(mockRemove).toHaveBeenCalledWith([path]);
  mockRemove.mockClear();stubStorage({"": [{name:PROJECT_A}],[PROJECT_A]:[{name:FILE_A,created_at:RECENT}]});
  expect(await scanNatoriInquiryReferenceOrphans({dryRun:false})).toMatchObject({deletedCount:0});expect(mockRemove).not.toHaveBeenCalled();
 });
});
