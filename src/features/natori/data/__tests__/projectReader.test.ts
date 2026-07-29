import { describe, expect, it } from "vitest";
import { rowToProject, type ProjectRow } from "@/features/natori/data/supabaseProjects";

function makeRow(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "project-1",
    user_id: "owner-1",
    title: "相談案件",
    client_name: "依頼者",
    amount: 12000,
    type: "icon",
    status: "inquiry",
    delivery_plan: "normal",
    priority: null,
    start_date: null,
    due_date: "2026-08-01",
    created_at: "2026-07-27T03:04:05.000Z",
    next_action: "内容確認",
    note: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("rowToProject nullable compatibility", () => {
  it("preserves null amount and due date without converting them to zero or a date", () => {
    const project = rowToProject(
      makeRow({ amount: null, due_date: null }),
      [],
      []
    );

    expect(project.amount).toBeNull();
    expect(project.dueDate).toBeNull();
    expect(project.createdAt).toBe("2026-07-27T03:04:05.000Z");
  });

  it("preserves zero as a concrete free amount", () => {
    expect(rowToProject(makeRow({ amount: 0 }), [], []).amount).toBe(0);
  });

  it("reads undecided and unknown future type values as undecided", () => {
    expect(rowToProject(makeRow({ type: "undecided" }), [], []).type).toBe(
      "undecided"
    );
    expect(rowToProject(makeRow({ type: "future-type" }), [], []).type).toBe(
      "undecided"
    );
  });

  it("keeps the task rows returned by the read path without generating a template", () => {
    const project = rowToProject(
      makeRow({ type: "undecided" }),
      [
        {
          id: "task-row-1",
          project_id: "project-1",
          task_key: "custom",
          label: "既存タスク",
          stage: "rough",
          estimated_hours: null,
          done: false,
          sort_order: 0,
        },
      ],
      []
    );

    expect(project.tasks).toEqual([
      {
        id: "custom",
        label: "既存タスク",
        stage: "rough",
        done: false,
        estimatedHours: undefined,
      },
    ]);
  });
});
