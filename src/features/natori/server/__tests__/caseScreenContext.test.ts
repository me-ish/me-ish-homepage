import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), sign: vi.fn() }));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({ rpc: m.rpc }),
}));
vi.mock("../natoriOwner", () => ({
  resolveNatoriManagementContext: async () => ({
    ownerId: "22222222-2222-4222-8222-222222222222",
  }),
}));
vi.mock("../portfolioSiteService", () => ({
  signPortfolioReferenceImage: m.sign,
}));
vi.mock("../projectsService", () => ({
  referenceFileDisplayName: (_: string, i: number) => `資料${i + 1}`,
}));
import { readCaseContext, readCasePlanning } from "../caseScreenContext";
const id = "11111111-1111-4111-8111-111111111111";
const project = {
  id,
  status: "inquiry",
  nextAction: "確認",
  title: "架空案件",
  clientName: "合成依頼者",
  clientEmail: null,
  amount: null,
  type: "undecided",
  deliveryPlan: "normal",
  priority: null,
  startDate: null,
  dueDate: null,
  createdAt: "2026-10-20T00:00:00Z",
  note: null,
  requestData: null,
  mutationRevision: 0,
  tasks: [],
  paymentConfirmedAt: null,
  paidAt: null,
  paidAmount: null,
  completedAt: null,
  deliveryAcceptedAt: null,
  deliveredMailAt: null,
  deletedAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockResolvedValue({
    data: {
      project,
      revision: "a".repeat(64),
      links: [],
      files: [{ path: id + "/synthetic.webp" }],
    },
    error: null,
  });
  m.sign.mockRejectedValue(Error("isolated Storage unavailable"));
});
it("signs only an owned scoped source and preserves a submitted file when signing fails", async () => {
  const result = await readCaseContext(id);
  expect(result?.filesState).toBe("unavailable");
  expect(result?.files).toEqual([{ name: "資料1", url: null }]);
  expect(JSON.stringify(result)).not.toContain("synthetic.webp");
  expect(m.rpc).toHaveBeenCalledWith(
    "natori_case_context_read_v1",
    { p_owner: "22222222-2222-4222-8222-222222222222", p_project: id },
    { get: true },
  );
});
it("does not sign files if the project identity is missing or wrong", async () => {
  m.rpc.mockResolvedValue({ data: null, error: null });
  expect(await readCaseContext(id)).toBeNull();
  m.rpc.mockResolvedValue({
    data: {
      project: { ...project, id: "33333333-3333-4333-8333-333333333333" },
      revision: "a".repeat(64),
      links: [],
      files: [{ path: "foreign" }],
    },
    error: null,
  });
  await expect(readCaseContext(id)).rejects.toThrow("scope_mismatch");
  expect(m.sign).not.toHaveBeenCalled();
});
it("does not represent unavailable planning as an empty successful list", async () => {
  m.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  await expect(readCasePlanning()).rejects.toThrow("planning_unavailable");
});
