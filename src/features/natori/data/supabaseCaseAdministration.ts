import { CSRF_HEADERS } from "@/lib/auth/csrf";
import {
  caseAdminView,
  caseAdminReceipt,
  type CaseAdminRequest,
} from "../lib/caseAdministration";
export async function loadCaseAdministration(
  projectId: string | null,
  operationId?: string,
  notificationId?: string,
) {
  const params = new URLSearchParams();
  if (projectId) params.set("projectId", projectId);
  if (operationId) params.set("operationId", operationId);
  if (notificationId) params.set("notificationId", notificationId);
  const response = await fetch(
    `/api/natori/admin/case-administration?${params}`,
    { cache: "no-store", credentials: "same-origin" },
  );
  if (!response.ok)
    throw Error(
      response.status === 401
        ? "認証が失効しました。ログイン後に結果を照会してください。"
        : "記録を取得できません。新しい操作を作らず、再照会してください。",
    );
  const value: unknown = await response.json(),
    v = value as { view: unknown; receipt: unknown };
  if(notificationId){const selected=caseAdminView.parse(v.view);if(selected.project.id!==projectId||selected.selectedNotice?.id!==notificationId||selected.notices.length!==1||selected.notices[0].id!==notificationId)throw Error("通知の対象を確認できません。");}
  return {
    view: v.view ? caseAdminView.parse(v.view) : null,
    receipt: v.receipt ? caseAdminReceipt.parse(v.receipt) : null,
  };
}
export async function submitCaseAdministration(
  request: CaseAdminRequest,
): Promise<{
  result: string;
  projectId?: string;
  notificationId?: string;
  replayed?: boolean;
}> {
  let response: Response;
  try {
    response = await fetch("/api/natori/admin/case-administration", {
      method: "POST",
      credentials: "same-origin",
      headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw Error("結果を確認できません。同じ操作の記録を照会してください。");
  }
  if (!response.ok)
    throw Error("結果を確認できません。同じ操作の記録を照会してください。");
  return await response.json();
}
