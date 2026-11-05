// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import ClientCaseItems from "../ClientCaseItems";

afterEach(cleanup);

it("lists each item with its progress and due date, without any amount", () => {
  render(<ClientCaseItems items={[
    { position: 1, title: "クリスマス等身", progress: "in_progress", dueDate: "2026-12-20", handedOverAt: null },
    { position: 2, title: "正月等身", progress: "not_started", dueDate: null, handedOverAt: null },
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

it("shows the handover day for an item that was delivered ahead", () => {
  render(<ClientCaseItems items={[
    { position: 1, title: "クリスマス等身", progress: "done", dueDate: "2026-12-20", handedOverAt: "2026-12-18" },
    { position: 2, title: "正月等身", progress: "in_progress", dueDate: "2026-12-30", handedOverAt: null },
  ]} />);
  expect(screen.getByText("12月18日にお渡し済み")).not.toBeNull();
  expect(screen.getByText("お渡し済み")).not.toBeNull();
  expect(screen.queryByText("納期 12月20日ごろ")).toBeNull();
  expect(screen.getByText("納期 12月30日ごろ")).not.toBeNull();
});
