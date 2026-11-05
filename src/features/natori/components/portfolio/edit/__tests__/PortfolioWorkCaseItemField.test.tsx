// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PortfolioWorkCaseItemField } from "../PortfolioWorkCaseItemField";

afterEach(cleanup);
const ID = "11111111-1111-4111-8111-111111111111";
const options = [{ id: ID, caseTitle: "AYMR様", position: 1, title: "クリスマス等身", publicationPolicy: "delayed" as const, publicationAllowedFrom: "2026-12-26" }];

it("links a work to an item and says when it will appear", () => {
  const onChange = vi.fn();
  const { rerender } = render(<PortfolioWorkCaseItemField value={null} options={options} today="2026-12-01" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("案件の品目に結ぶ"), { target: { value: ID } });
  expect(onChange).toHaveBeenCalledWith(ID);
  rerender(<PortfolioWorkCaseItemField value={ID} options={options} today="2026-12-01" onChange={onChange} />);
  expect(screen.getByText("12月26日から自動でサイトに出ます。それまでは出ません。")).not.toBeNull();
  fireEvent.change(screen.getByLabelText("案件の品目に結ぶ"), { target: { value: "" } });
  expect(onChange).toHaveBeenLastCalledWith(null);
});

it("stays out of the way when items cannot be read and nothing is linked", () => {
  const { container } = render(<PortfolioWorkCaseItemField value={null} options={null} today="2026-12-01" onChange={vi.fn()} />);
  expect(container.textContent).toBe("");
});
