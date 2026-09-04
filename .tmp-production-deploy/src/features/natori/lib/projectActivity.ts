export const NATORI_PROJECT_ACTIVITY_EVENT_TYPES = [
  "quote_issued",
  "mail_sent",
  "payment_recorded",
  "delivery_sent",
  "delivery_accepted",
] as const;

export type NatoriProjectActivityEventType =
  (typeof NATORI_PROJECT_ACTIVITY_EVENT_TYPES)[number];

export const NATORI_PROJECT_ACTIVITY_SOURCE_TYPES = [
  "quote",
  "order_mail",
  "payment_transaction",
  "project",
] as const;

export type NatoriProjectActivitySourceType =
  (typeof NATORI_PROJECT_ACTIVITY_SOURCE_TYPES)[number];

export type NatoriProjectActivity = {
  id: string;
  projectId: string;
  eventType: NatoriProjectActivityEventType;
  sourceType: NatoriProjectActivitySourceType;
  sourceId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

type ActivityRow = {
  id: unknown;
  project_id: unknown;
  event_type: unknown;
  source_type: unknown;
  source_id: unknown;
  payload: unknown;
  occurred_at: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEventType(value: unknown): value is NatoriProjectActivityEventType {
  return (
    typeof value === "string" &&
    NATORI_PROJECT_ACTIVITY_EVENT_TYPES.includes(
      value as NatoriProjectActivityEventType,
    )
  );
}

function isSourceType(value: unknown): value is NatoriProjectActivitySourceType {
  return (
    typeof value === "string" &&
    NATORI_PROJECT_ACTIVITY_SOURCE_TYPES.includes(
      value as NatoriProjectActivitySourceType,
    )
  );
}

export function parseNatoriProjectActivityRow(
  value: unknown,
): NatoriProjectActivity | null {
  if (!isRecord(value)) return null;
  const row = value as ActivityRow;
  if (
    typeof row.id !== "string" ||
    typeof row.project_id !== "string" ||
    !isEventType(row.event_type) ||
    !isSourceType(row.source_type) ||
    typeof row.source_id !== "string" ||
    !isRecord(row.payload) ||
    typeof row.occurred_at !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    projectId: row.project_id,
    eventType: row.event_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    payload: row.payload,
    occurredAt: row.occurred_at,
  };
}

export function getNatoriProjectActivityLabel(
  eventType: NatoriProjectActivityEventType,
): string {
  switch (eventType) {
    case "quote_issued":
      return "正式見積を発行";
    case "mail_sent":
      return "メールを送信";
    case "payment_recorded":
      return "入金記録を作成";
    case "delivery_sent":
      return "納品メールを送信";
    case "delivery_accepted":
      return "依頼者が納品を受領";
  }
}
