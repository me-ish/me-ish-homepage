// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExternalAmount } from "../CaseAdministrationPanel";
import type { CaseAdminView } from "../../../lib/caseAdministration";

afterEach(cleanup);
const view = (amount: number | null) =>
  ({ project: { title: "冬の依頼", clientName: "架空さん", amount, deliveryPlan: "normal", startDate: null, dueDate: null, note: null } }) as unknown as CaseAdminView;

it("offers the items total when it differs from the case amount, then saves it", () => {
  const prepare = vi.fn();
  render(<ExternalAmount view={view(26000)} itemsTotal={30000} disabled={false} prepare={prepare} onDirty={() => {}} />);
  expect(screen.getByText(/品目の合計は30,000円です/)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "品目の合計を入れる" }));
  expect((screen.getByLabelText("金額（円）") as HTMLInputElement).value).toBe("30000");
  fireEvent.click(screen.getByRole("button", { name: "金額を保存" }));
  expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ amount: 30000 }));
});

it("says nothing when the case amount already matches the items", () => {
  render(<ExternalAmount view={view(30000)} itemsTotal={30000} disabled={false} prepare={() => {}} onDirty={() => {}} />);
  expect(screen.queryByText(/品目の合計は/)).toBeNull();
});
