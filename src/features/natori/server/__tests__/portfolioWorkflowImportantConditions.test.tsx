import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultPortfolioContent } from "@/features/natori/constants/portfolioContent";
import { parsePortfolioDisplayContent } from "@/features/natori/lib/portfolioDisplay";
import { resolvePortfolioWorkflow } from "@/features/natori/lib/portfolioWorkflow";
import PortfolioWorkflow from "@/features/natori/components/portfolio/PortfolioWorkflow";
import snapshot from "../../lib/__tests__/fixtures/portfolioWorkflow.public-20261001.json";

const revisionLimit = "色味などの軽微な修正のみ対応可能です。";
it.each(["default", "saved"])('retains the final revision limit in the %s legacy derived public view', variant => {
  const workflow = defaultPortfolioContent.workflow.map(step => ({ ...step }));
  if (variant === "saved") workflow[2].body = "お見積もりにご承諾いただけましたら、お支払い用のリンクをメールでお送りします。ご入金の確認後、制作を開始いたします。";
  const before = JSON.stringify(workflow);
  const view = parsePortfolioDisplayContent({ ...defaultPortfolioContent, workflow });
  expect(view?.workflowProjectionAllowed).toBe(true);
  const projected = resolvePortfolioWorkflow(workflow);
  expect(projected).toHaveLength(5); expect(projected[4].body).toContain(revisionLimit);
  expect(renderToStaticMarkup(<PortfolioWorkflow content={view!} />)).toContain(revisionLimit);
  expect(view?.workflow).toEqual(workflow); expect(JSON.stringify(workflow)).toBe(before);
});
it('changes only the three approved observed public fields and retains all later condition text', () => {
  const workflow = snapshot.workflow.map(step => ({ ...step })), before = JSON.stringify(workflow);
  const projected = resolvePortfolioWorkflow(workflow);
  expect(projected.slice(2)).toEqual(workflow.slice(2));
  expect(projected[4].body).not.toContain(revisionLimit);
  expect(JSON.stringify(workflow)).toBe(before);
});
it('leaves independently customized workflow text, count and original input unchanged', () => {
  const workflow = defaultPortfolioContent.workflow.map(step => ({ ...step }));
  workflow[4].body += " Synthetic custom agreed condition.";
  const before = JSON.stringify(workflow), projected = resolvePortfolioWorkflow(workflow);
  expect(projected).toBe(workflow); expect(projected).toHaveLength(6);
  expect(projected[4].body).toContain(revisionLimit); expect(projected[4].body).toContain("Synthetic custom agreed condition.");
  expect(JSON.stringify(workflow)).toBe(before);
});
