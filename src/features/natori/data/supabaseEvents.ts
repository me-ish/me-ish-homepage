// natori 管理画面のイベントデータアクセス。
// 認可（合言葉キー / ログイン）はサーバー側 API に任せるため、
// ブラウザ Supabase ではなく /api/natori/admin/events を経由する。
import { CSRF_HEADERS } from "@/lib/auth/csrf";

export type NatoriEvent = {
  id: string;
  title: string;
  date: string;
  note?: string;
};

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  date: string;
  note: string | null;
};

const API_PATH = "/api/natori/admin/events";

function rowToEvent(row: EventRow): NatoriEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    note: row.note ?? undefined,
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `${fallback} (${response.status})`;
}

export async function fetchNatoriEvents(): Promise<NatoriEvent[]> {
  const response = await fetch(API_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "予定の読み込みに失敗しました"));
  }
  const payload = (await response.json()) as { events?: EventRow[] };
  return (payload.events ?? []).map(rowToEvent);
}

export async function createNatoriEvent(input: {
  title: string;
  date: string;
  note?: string;
}): Promise<NatoriEvent> {
  const response = await fetch(API_PATH, {
    method: "POST",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "予定の作成に失敗しました"));
  }
  const payload = (await response.json()) as { event: EventRow };
  return rowToEvent(payload.event);
}

export async function updateNatoriEvent(
  id: string,
  input: { title?: string; date?: string; note?: string | null }
): Promise<void> {
  const response = await fetch(API_PATH, {
    method: "PATCH",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...input }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "予定の更新に失敗しました"));
  }
}

export async function deleteNatoriEvent(id: string): Promise<void> {
  const response = await fetch(`${API_PATH}?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...CSRF_HEADERS },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "予定の削除に失敗しました"));
  }
}
