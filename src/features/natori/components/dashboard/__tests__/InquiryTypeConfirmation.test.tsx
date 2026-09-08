// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InquiryTypeConfirmation from "@/features/natori/components/dashboard/inquiry/InquiryTypeConfirmation";

afterEach(() => cleanup());

describe("InquiryTypeConfirmation", () => {
  it("does not preselect icon for an undecided project", () => {
    render(
      <InquiryTypeConfirmation
        projectType="undecided"
        taskCount={0}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const select = screen.getByLabelText("案件種別") as HTMLSelectElement;
    const button = screen.getByRole("button", { name: "案件種別を確定する" }) as HTMLButtonElement;

    expect(select.value).toBe("");
    expect(button.disabled).toBe(true);

    fireEvent.change(select, { target: { value: "standing" } });
    expect(select.value).toBe("standing");
    expect(button.disabled).toBe(false);
  });
});
