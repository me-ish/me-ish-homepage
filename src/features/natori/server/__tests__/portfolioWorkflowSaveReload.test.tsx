import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { NATORI_INTAKE_COPY } from "@/features/natori/constants/portfolioContactCopy";
import { preparePortfolioContentForSave, withPortfolioEditorStableIds } from "@/features/natori/lib/portfolioContent";
import { parsePortfolioDisplayContent, preparePortfolioDisplayPreview } from "@/features/natori/lib/portfolioDisplay";
import PortfolioWorkflow from "@/features/natori/components/portfolio/PortfolioWorkflow";
import snapshot from "../../lib/__tests__/fixtures/portfolioWorkflow.public-20261001.json";

const state = vi.hoisted(() => ({ stored: null as unknown, upserts: 0 }));
vi.mock("server-only", () => ({}));
vi.mock("sharp", () => ({ default: vi.fn() }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: vi.fn().mockResolvedValue(false) }));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: vi.fn(() => ({ from: vi.fn(() => ({
  select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: async () => ({ data: { content: state.stored }, error: null }) })) })),
  upsert: async ({ content }: { content: unknown }) => { state.stored = JSON.parse(JSON.stringify(content)); state.upserts++; return { error: null }; },
})) })) }));
import { loadPortfolioContent, savePortfolioContent } from "@/features/natori/server/portfolioSiteService";

function rawContent() { return { ...defaultPortfolioContent, workflow: snapshot.workflow.map(step => ({ ...step })) }; }
function render(content: Awaited<ReturnType<typeof loadPortfolioContent>>) {
  return renderToStaticMarkup(<PortfolioWorkflow content={content} />);
}
beforeEach(() => { state.upserts = 0; });

it.each([0, 1, 2, 3, 4])("preserves custom raw row %s after unrelated editor save and actual reader reload", async index => {
  const raw = rawContent();
  Object.assign(raw.workflow[index], { importantNotice: "SYNTHETIC_PRIVATE_EXTRA_NEVER_SERIALIZED" });
  const original = JSON.stringify(raw); state.stored = raw;
  const loaded = await loadPortfolioContent(); expect(loaded.workflowProjectionAllowed).toBe(false);
  const editor = { ...withPortfolioEditorStableIds(loaded, () => "synthetic-id"), artistName: "Synthetic unrelated title edit" };
  const prepared = preparePortfolioContentForSave(editor); expect(prepared).not.toBeNull();
  expect(prepared?.workflowCompatibilityProjection).toBe(false);
  expect(Object.hasOwn(prepared!, "workflowProjectionAllowed")).toBe(false);
  expect(JSON.stringify(prepared)).not.toContain("SYNTHETIC_PRIVATE_EXTRA_NEVER_SERIALIZED");
  expect((await savePortfolioContent(prepared)).kind).toBe("ok"); expect(state.upserts).toBe(1);
  const reloaded = await loadPortfolioContent();
  expect(reloaded.artistName).toBe("Synthetic unrelated title edit");
  expect(reloaded.workflowProjectionAllowed).toBe(false);
  expect(render(reloaded)).toContain(raw.workflow[1].body);
  expect(render(reloaded)).not.toContain(NATORI_INTAKE_COPY.reply);
  expect(JSON.stringify(raw)).toBe(original);
  const afterSavePreview = preparePortfolioDisplayPreview(prepared!);
  expect(afterSavePreview?.workflowProjectionAllowed).toBe(false);
  expect(parsePortfolioDisplayContent(JSON.parse(JSON.stringify(afterSavePreview)))?.workflowProjectionAllowed).toBe(false);
});

it("keeps a false-only saved preference across repeated ordinary saves without storing the read marker", async () => {
  state.stored = { ...rawContent(), workflowCompatibilityProjection: false };
  for (const artistName of ["Synthetic edit one", "Synthetic edit two"]) {
    const loaded = await loadPortfolioContent(); expect(loaded.workflowProjectionAllowed).toBe(false);
    const prepared = preparePortfolioContentForSave({ ...loaded, artistName });
    expect((await savePortfolioContent(prepared)).kind).toBe("ok");
    expect(state.stored).toMatchObject({ artistName, workflowCompatibilityProjection: false });
    expect(Object.hasOwn(state.stored as object, "workflowProjectionAllowed")).toBe(false);
  }
  expect((await loadPortfolioContent()).workflowProjectionAllowed).toBe(false);
});

it("does not let caller true fields grant raw custom shape eligibility through save normalization", async () => {
  const raw = { ...rawContent(), workflowCompatibilityProjection: true, workflowProjectionAllowed: true };
  Object.assign(raw.workflow[2], { customTerms: "SYNTHETIC_PRIVATE_EXTRA_NEVER_SERIALIZED" });
  expect((await savePortfolioContent(raw)).kind).toBe("ok");
  expect(state.stored).toMatchObject({ workflowCompatibilityProjection: false });
  expect(JSON.stringify(state.stored)).not.toContain("SYNTHETIC_PRIVATE_EXTRA_NEVER_SERIALIZED");
  expect(Object.hasOwn(state.stored as object, "workflowProjectionAllowed")).toBe(false);
  expect((await loadPortfolioContent()).workflowProjectionAllowed).toBe(false);
});

it("strips an unsupported positive saved setting while still independently checking exact baseline eligibility", async () => {
  const raw = { ...rawContent(), workflowCompatibilityProjection: true, workflowProjectionAllowed: true };
  expect((await savePortfolioContent(raw)).kind).toBe("ok");
  expect(Object.hasOwn(state.stored as object, "workflowCompatibilityProjection")).toBe(false);
  expect(Object.hasOwn(state.stored as object, "workflowProjectionAllowed")).toBe(false);
  expect((await loadPortfolioContent()).workflowProjectionAllowed).toBe(true);
});

it("keeps an exact observed baseline eligible after unrelated normal save without rewriting stored copy", async () => {
  const raw = rawContent(); state.stored = raw;
  const loaded = await loadPortfolioContent(); expect(loaded.workflowProjectionAllowed).toBe(true);
  const prepared = preparePortfolioContentForSave({ ...loaded, artistName: "Synthetic baseline edit" });
  expect((await savePortfolioContent(prepared)).kind).toBe("ok");
  const reloaded = await loadPortfolioContent(); expect(reloaded.workflowProjectionAllowed).toBe(true);
  expect(reloaded.workflow).toEqual(raw.workflow);
  expect(render(reloaded)).toContain(NATORI_INTAKE_COPY.reply);
  expect(JSON.stringify(state.stored)).not.toContain(NATORI_INTAKE_COPY.reply);
});

it("keeps custom important text and unrelated sections unchanged through the same save and reload", async () => {
  const raw = rawContent(); raw.workflow[3].body += " Synthetic important condition: restricted usage remains.";
  state.stored = raw;
  const loaded = await loadPortfolioContent();
  expect((await savePortfolioContent(preparePortfolioContentForSave(loaded))).kind).toBe("ok");
  const reloaded = await loadPortfolioContent();
  expect(reloaded.workflowProjectionAllowed).toBe(false);
  expect(reloaded.workflow).toEqual(raw.workflow);
  expect(reloaded.works).toEqual(raw.works);
  expect(reloaded.requests).toEqual(raw.requests);
  expect(reloaded.deliveryNotes).toEqual(raw.deliveryNotes);
  expect(render(reloaded)).toContain("Synthetic important condition: restricted usage remains.");
});
