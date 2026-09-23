import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { from, owner } = vi.hoisted(() => ({ from: vi.fn(), owner: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: () => ({ from }) }));
vi.mock("@/features/natori/server/natoriOwner", () => ({ resolveNatoriActingUserId: owner }));

import { getEstimateDraft, saveEstimateDraft } from "@/features/natori/server/estimateDraftService";

const projectId = "60000000-0000-4000-8000-000000000001";
const userId = "60000000-0000-4000-8000-000000000002";

beforeEach(() => {
  from.mockReset(); owner.mockResolvedValue(userId);
});

describe("estimate draft owner scope", () => {
  it("reads only an active project belonging to the acting owner", async () => {
    const projectQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: projectId, status: "inquiry", deleted_at: null }, error: null }) };
    projectQuery.select.mockReturnValue(projectQuery); projectQuery.eq.mockReturnValue(projectQuery);
    const draftQuery = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    draftQuery.select.mockReturnValue(draftQuery); draftQuery.eq.mockReturnValue(draftQuery);
    from.mockImplementation((table: string) => table === "natori_projects" ? projectQuery : draftQuery);
    expect(await getEstimateDraft(projectId)).toEqual({ kind: "ok", draft: null });
    expect(projectQuery.eq).toHaveBeenCalledWith("user_id", userId);
    expect(draftQuery.eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("rejects writes once the project is in production", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: projectId, status: "rough", deleted_at: null }, error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
    from.mockReturnValue(query);
    expect(await saveEstimateDraft(projectId, 0, { agreedTerms: {} as never, items: [] })).toEqual({ kind: "invalid-state" });
    expect(from).toHaveBeenCalledTimes(1);
  });
});
