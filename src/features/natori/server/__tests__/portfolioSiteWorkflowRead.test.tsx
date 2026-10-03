import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { NATORI_INTAKE_COPY } from "@/features/natori/constants/portfolioContactCopy";
import publicSnapshot from "../../lib/__tests__/fixtures/portfolioWorkflow.public-20261001.json";
import { parsePortfolioContent, preparePortfolioContentForSave, withPortfolioEditorStableIds } from "@/features/natori/lib/portfolioContent";
import { parsePortfolioDisplayContent, preparePortfolioDisplayPreview } from "@/features/natori/lib/portfolioDisplay";
import type { PortfolioDisplayContent } from "@/features/natori/types/portfolioDisplay";

vi.mock("server-only", () => ({}));
vi.mock("sharp", () => ({ default: vi.fn() }));
vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({ canUseNatoriManagement: vi.fn().mockResolvedValue(false) }));
const { maybeSingle, insert, update, upsert, remove } = vi.hoisted(() => ({
  maybeSingle: vi.fn(), insert: vi.fn(), update: vi.fn(), upsert: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: vi.fn(() => ({ from: vi.fn(() => ({
  select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })), insert, update, upsert, delete: remove,
})) })) }));
import { loadPortfolioContent } from "@/features/natori/server/portfolioSiteService";
import PortfolioWorkflow from "@/features/natori/components/portfolio/PortfolioWorkflow";

function rawContent() {
  return { ...defaultPortfolioContent, artistName: "Synthetic custom artist",
    workflow: publicSnapshot.workflow.map(step => ({ ...step })) };
}
function renderView(content: PortfolioDisplayContent): string {
  // Exercise the same serialization boundary as a validated public read response.
  const serialized = JSON.parse(JSON.stringify(content)) as PortfolioDisplayContent;
  return renderToStaticMarkup(<PortfolioWorkflow content={serialized} />);
}
beforeEach(() => { vi.clearAllMocks(); });

describe("raw stored workflow eligibility survives the real content reader", () => {
  it("projects the exact observed raw revision through DB read and serialized renderer without writing", async () => {
    const raw = rawContent(), before = JSON.stringify(raw);
    maybeSingle.mockResolvedValue({ data: { content: raw }, error: null });
    const content = await loadPortfolioContent();
    expect(content.workflowProjectionAllowed).toBe(true);
    expect(content.artistName).toBe(raw.artistName);
    expect(content.works).toEqual(raw.works);
    expect(content.workflow).toEqual(raw.workflow);
    const html = renderView(content);
    expect(html).toContain(NATORI_INTAKE_COPY.reply);
    expect(html).toContain(NATORI_INTAKE_COPY.next);
    expect(html).toContain(raw.workflow[3].body);
    expect(JSON.stringify(raw)).toBe(before);
    for (const mutation of [insert, update, upsert, remove]) expect(mutation).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2, 3, 4])("does not reproject a customized row shape stripped from stored step %s", async index => {
    const raw = rawContent();
    Object.assign(raw.workflow[index], { importantNotice: "UNVALIDATED_PRIVATE_EXTRA_DO_NOT_SERIALIZE" });
    const before = JSON.stringify(raw);
    maybeSingle.mockResolvedValue({ data: { content: raw }, error: null });
    const content = await loadPortfolioContent();
    expect(content.workflowProjectionAllowed).toBe(false);
    expect(Object.hasOwn(content.workflow[index], "importantNotice")).toBe(false);
    const html = renderView(content);
    expect(html).toContain(raw.workflow[0].body);
    expect(html).toContain(raw.workflow[1].body);
    expect(html).not.toContain(NATORI_INTAKE_COPY.reply);
    expect(JSON.stringify(content)).not.toContain("UNVALIDATED_PRIVATE_EXTRA_DO_NOT_SERIALIZE");
    expect(JSON.stringify(raw)).toBe(before);
    for (const mutation of [insert, update, upsert, remove]) expect(mutation).not.toHaveBeenCalled();
  });

  it.each(["body", "title", "order", "count"])("preserves custom workflow %s after parsing and public serialization", async change => {
    const raw = rawContent();
    if (change === "body") raw.workflow[3].body += " Custom important condition.";
    if (change === "title") raw.workflow[0].title = "Custom title";
    if (change === "order") [raw.workflow[2], raw.workflow[3]] = [raw.workflow[3], raw.workflow[2]];
    if (change === "count") raw.workflow.pop();
    maybeSingle.mockResolvedValue({ data: { content: raw }, error: null });
    const content = await loadPortfolioContent();
    expect(content.workflowProjectionAllowed).toBe(false);
    expect(content.workflow).toEqual(raw.workflow);
    expect(renderView(content)).toContain(raw.workflow[1].body);
  });

  it("also preserves a customized six-step legacy shape", async () => {
    const raw = { ...defaultPortfolioContent, workflow: defaultPortfolioContent.workflow.map(step => ({ ...step })) };
    Object.assign(raw.workflow[0], { importantNotice: "CUSTOM_EXTRA" });
    maybeSingle.mockResolvedValue({ data: { content: raw }, error: null });
    const content = await loadPortfolioContent();
    expect(content.workflowProjectionAllowed).toBe(false);
    expect(content.workflow).toHaveLength(6);
    expect(renderView(content)).toContain(raw.workflow[1].body);
  });

  it("does not trust a caller-supplied eligibility marker or persist the read marker", async () => {
    const raw = { ...rawContent(), workflowProjectionAllowed: true };
    Object.assign(raw.workflow[0], { importantNotice: "CUSTOM_EXTRA" });
    maybeSingle.mockResolvedValue({ data: { content: raw }, error: null });
    const content = await loadPortfolioContent();
    expect(content.workflowProjectionAllowed).toBe(false);
    const stored = parsePortfolioContent(content);
    expect(stored).not.toBeNull();
    expect(Object.hasOwn(stored!, "workflowProjectionAllowed")).toBe(false);
  });

  it("keeps raw custom suppression through editor IDs, preview validation and localStorage parse", async () => {
    const raw = rawContent(); Object.assign(raw.workflow[0], { importantNotice: "CUSTOM_PRIVATE_EXTRA" });
    maybeSingle.mockResolvedValue({ data: { content: raw }, error: null });
    const content = await loadPortfolioContent();
    const editor = withPortfolioEditorStableIds(content, () => "synthetic-editor-id");
    const preview = preparePortfolioDisplayPreview(editor);
    expect(preview?.workflowProjectionAllowed).toBe(false);
    const parsed = parsePortfolioDisplayContent(JSON.parse(JSON.stringify(preview)));
    expect(parsed?.workflowProjectionAllowed).toBe(false);
    expect(renderView(parsed!)).toContain(raw.workflow[1].body);
    expect(JSON.stringify(parsed)).not.toContain("CUSTOM_PRIVATE_EXTRA");
    const actualSave = preparePortfolioContentForSave(editor);
    expect(Object.hasOwn(actualSave!, "workflowProjectionAllowed")).toBe(false);
    expect(actualSave?.workflow).toEqual(raw.workflow.map(step => ({ title: step.title, body: step.body })));
    for (const mutation of [insert, update, upsert, remove]) expect(mutation).not.toHaveBeenCalled();
  });

  it("keeps an exact default eligible in the ordinary editor preview", () => {
    const preview = preparePortfolioDisplayPreview(withPortfolioEditorStableIds(defaultPortfolioContent, () => "synthetic-editor-id"));
    expect(preview?.workflowProjectionAllowed).toBe(true);
    const parsed = parsePortfolioDisplayContent(JSON.parse(JSON.stringify(preview)));
    expect(parsed?.workflowProjectionAllowed).toBe(true);
    expect(renderView(parsed!)).toContain(NATORI_INTAKE_COPY.reply);
  });

  it.each(["missing", "invalid", "error", "throw"])("keeps the safe default SSR when the row is %s", async kind => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      if (kind === "throw") maybeSingle.mockRejectedValue(new Error("synthetic"));
      else maybeSingle.mockResolvedValue(kind === "missing" ? { data: null, error: null }
        : kind === "invalid" ? { data: { content: { workflow: [] } }, error: null } : { data: null, error: { message: "synthetic" } });
      const content = await loadPortfolioContent();
      expect(content.workflowProjectionAllowed).toBe(true);
      expect(content.works).toEqual(defaultPortfolioContent.works);
      expect(renderView(content)).toContain(NATORI_INTAKE_COPY.reply);
      expect(Object.hasOwn(defaultPortfolioContent, "workflowProjectionAllowed")).toBe(false);
    } finally { quiet.mockRestore(); }
  });
});
