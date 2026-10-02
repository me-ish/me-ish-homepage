import { defaultPortfolioContent } from "../constants/portfolioContent";
import type { PortfolioDisplayContent } from "../types/portfolioDisplay";
import { parsePortfolioContent, preparePortfolioContentForSave } from "./portfolioContent";
import { isPortfolioWorkflowProjectionEligible } from "./portfolioWorkflow";

export function parsePortfolioDisplayContent(value: unknown): PortfolioDisplayContent | null {
  // Capture eligibility from the raw row; Zod strips extra keys before rendering.
  const workflow = value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>).workflow : undefined;
  // Preserve both the read-view suppression and its false-only saved preference.
  // A supplied true marker or saved value never makes a custom/raw shape eligible.
  const suppressed = value !== null && typeof value === "object" && !Array.isArray(value)
    && ((value as Record<string, unknown>).workflowProjectionAllowed === false
      || (value as Record<string, unknown>).workflowCompatibilityProjection === false);
  const workflowProjectionAllowed = !suppressed && isPortfolioWorkflowProjectionEligible(workflow);
  const content = parsePortfolioContent(value);
  return content ? { ...content, workflowProjectionAllowed } : null;
}

export function defaultPortfolioDisplayContent(): PortfolioDisplayContent {
  return { ...defaultPortfolioContent,
    workflowProjectionAllowed: isPortfolioWorkflowProjectionEligible(defaultPortfolioContent.workflow) };
}

/** Keep negative eligibility across local preview validation and explicit editor saves. */
export function preparePortfolioDisplayPreview(content: PortfolioDisplayContent): PortfolioDisplayContent | null {
  const prepared = preparePortfolioContentForSave(content);
  return prepared ? { ...prepared, workflowProjectionAllowed: content.workflowProjectionAllowed !== false
    && prepared.workflowCompatibilityProjection !== false
    && isPortfolioWorkflowProjectionEligible(content.workflow) } : null;
}
