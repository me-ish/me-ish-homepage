import { describe, expect, it } from "vitest";
import {
  getNatoriProjectActivityLabel,
  parseNatoriProjectActivityRow,
} from "@/features/natori/lib/projectActivity";

describe("parseNatoriProjectActivityRow", () => {
  it("parses a valid activity row", () => {
    expect(
      parseNatoriProjectActivityRow({
        id: "activity-1",
        project_id: "project-1",
        event_type: "quote_issued",
        source_type: "quote",
        source_id: "quote-1",
        payload: { version: 2 },
        occurred_at: "2026-08-04T10:00:00.000Z",
      }),
    ).toEqual({
      id: "activity-1",
      projectId: "project-1",
      eventType: "quote_issued",
      sourceType: "quote",
      sourceId: "quote-1",
      payload: { version: 2 },
      occurredAt: "2026-08-04T10:00:00.000Z",
    });
  });

  it("rejects unknown event/source values and non-object payloads", () => {
    expect(
      parseNatoriProjectActivityRow({
        id: "activity-1",
        project_id: "project-1",
        event_type: "unknown",
        source_type: "quote",
        source_id: "quote-1",
        payload: {},
        occurred_at: "2026-08-04T10:00:00.000Z",
      }),
    ).toBeNull();

    expect(
      parseNatoriProjectActivityRow({
        id: "activity-1",
        project_id: "project-1",
        event_type: "quote_issued",
        source_type: "quote",
        source_id: "quote-1",
        payload: [],
        occurred_at: "2026-08-04T10:00:00.000Z",
      }),
    ).toBeNull();
  });
});

describe("getNatoriProjectActivityLabel", () => {
  it("returns Japanese timeline labels", () => {
    expect(getNatoriProjectActivityLabel("quote_issued")).toBe("正式見積を発行");
    expect(getNatoriProjectActivityLabel("delivery_accepted")).toBe(
      "依頼者が納品を受領",
    );
  });
});
