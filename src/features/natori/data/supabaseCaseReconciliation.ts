import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { reconciliationView, type ReconciliationView } from "../lib/caseReconciliation";

export class ReconciliationReadError extends Error {
  constructor(readonly unauthorized: boolean) { super(unauthorized ? "ログインが切れました。もう一度ログインしてください。" : "うまくいったか分かりません。「いまの記録を読み込む」を押してください。"); }
}
export async function readReconciliation(project: string, signal?: AbortSignal, notificationId?:string): Promise<ReconciliationView | null> {
  const r = await fetch(`/api/natori/admin/case-reconciliation?${new URLSearchParams({ projectId: project,...(notificationId?{notificationId}:{}) })}`, { cache: "no-store", signal });
  if (!r.ok) throw new ReconciliationReadError(r.status === 401);
  const value = await r.json();
  if(value.enabled===false)return null;
  const view=reconciliationView.parse(value.view);
  if(notificationId&&(view.selectedNotice!==notificationId||view.notifications.length!==1||view.notifications[0].id!==notificationId))throw new ReconciliationReadError(false);
  return view;
}
export async function postReconciliation(command: unknown): Promise<string> {
  const r = await fetch("/api/natori/admin/case-reconciliation", { method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify(command), cache: "no-store" });
  if (r.status === 401) throw new ReconciliationReadError(true);
  if (![200, 409].includes(r.status)) throw new ReconciliationReadError(false);
  const value: { result: string } = await r.json();
  return value.result;
}
