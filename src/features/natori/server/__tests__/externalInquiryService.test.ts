import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { from, owner } = vi.hoisted(() => ({ from: vi.fn(), owner: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from }) }));
vi.mock("@/features/natori/server/natoriOwner", () => ({ resolveNatoriActingUserId: owner }));
import { createExternalNatoriInquiry } from "@/features/natori/server/externalInquiryService";

beforeEach(() => { from.mockReset(); owner.mockResolvedValue("owner"); });

describe("external consultation entry", () => {
  it("creates an undecided, unpriced project without inventing a deadline", async () => {
    const query = { insert: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: "project" }, error: null }) };
    query.insert.mockReturnValue(query); query.select.mockReturnValue(query); from.mockReturnValue(query);
    const result = await createExternalNatoriInquiry({ clientName: "依頼者", title: "一枚絵", clientEmail: "", source: "DM", note: "用途を相談" });
    expect(result).toEqual({ kind: "ok", projectId: "project" });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ type: "undecided", amount: null, due_date: null, client_email: null }));
  });
});
