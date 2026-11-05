// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ClientCaseItems from "../ClientCaseItems";

afterEach(cleanup);

it("lists each item with its progress and due date, without any amount", () => {
  render(<ClientCaseItems items={[
    { position: 1, title: "クリスマス等身", progress: "in_progress", dueDate: "2026-12-20" },
    { position: 2, title: "正月等身", progress: "not_started", dueDate: null },
  ]} />);
  expect(screen.getByRole("heading", { name: "ご依頼の内容（2点）" })).not.toBeNull();
  expect(screen.getByText("① クリスマス等身")).not.toBeNull();
  expect(screen.getByText("納期 12月20日ごろ")).not.toBeNull();
  expect(screen.getByText("制作中")).not.toBeNull();
  expect(screen.getByText("これから")).not.toBeNull();
  expect(document.body.textContent).not.toMatch(/円/);
});

it("shows nothing for a case without items", () => {
  const { container } = render(<ClientCaseItems items={[]} />);
  expect(container.textContent).toBe("");
});
