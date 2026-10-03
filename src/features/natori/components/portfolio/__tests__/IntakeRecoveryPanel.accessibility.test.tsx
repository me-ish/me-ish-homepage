// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import IntakeRecoveryPanel from "@/features/natori/components/portfolio/IntakeRecoveryPanel";
import type { useIntakeOperation } from "@/features/natori/components/portfolio/useIntakeOperation";
import type { FrozenIntakeOperation } from "@/features/natori/data/intakeOperationClient";

const fields = { name: "Original client", email: "original@example.invalid", requestType: "Original type", details: "Original multiline condition\nSecond line", futureCustom: "Exact custom original" };
function draft(last: number): FrozenIntakeOperation {
  return { operationId: `10000000-0000-4000-8000-00000000000${last}`, requestHash: "0".repeat(64), fields, manifest: [] };
}
function intake(originalAnswers: FrozenIntakeOperation[]): ReturnType<typeof useIntakeOperation> {
  return { operation: null, originalAnswers, busy: false, frozen: false, message: "Synthetic editable recovery", selectedNames: [],
    submit: async () => undefined, check: async () => undefined, retry: async () => undefined, settle: async () => undefined,
    selectFiles: () => undefined, confirmOriginalAnswers: () => undefined };
}
afterEach(cleanup);

describe("original answer native label association", () => {
  it("keeps the original answer text outside the actual label text", () => {
    const { container } = render(<IntakeRecoveryPanel intake={intake([draft(1)])} />);
    const label = container.querySelector("label")!;
    expect(label.textContent).toBe("保存した入力内容");
    expect(label.querySelector("textarea")).toBeNull();
    expect(label.control).toBe(screen.getByLabelText("保存した入力内容"));
    expect(label.control).toHaveProperty("readOnly", true);
  });

  it("uses a distinct explicit target for every original in multiple mounted panels", () => {
    const originalAnswers = [draft(1), draft(2)];
    const { container } = render(<><IntakeRecoveryPanel intake={intake(originalAnswers)} /><IntakeRecoveryPanel intake={intake(originalAnswers)} /></>);
    const labels = Array.from(container.querySelectorAll("label"));
    expect(labels).toHaveLength(4);
    expect(new Set(labels.map(label => label.htmlFor)).size).toBe(4);
    for (const label of labels) {
      expect(label.htmlFor).not.toBe("");
      expect(document.getElementById(label.htmlFor)).toBe(label.control);
      expect(label.control).toBeInstanceOf(HTMLTextAreaElement);
    }
  });

  it("retains all readable multiline answers and exact raw fields in readonly controls", () => {
    render(<IntakeRecoveryPanel intake={intake([draft(1)])} />);
    const readable = screen.getByLabelText("保存した入力内容") as HTMLTextAreaElement;
    expect(readable.readOnly).toBe(true);
    expect(readable.value).toContain("お名前：Original client");
    expect(readable.value).toContain("Original multiline condition\nSecond line");
    const original = screen.getByLabelText("元の保存情報") as HTMLTextAreaElement;
    expect(original.readOnly).toBe(true); expect(JSON.parse(original.value)).toEqual(fields);
  });
});
