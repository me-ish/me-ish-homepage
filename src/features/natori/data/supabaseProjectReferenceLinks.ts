// features/natori/data/supabaseProjectReferenceLinks.ts
// 外部参照リンク CRUD の client 側入口。admin API 経由でのみ操作し、
// 認可・owner scope・archive guard は server service が担保する。
// P1-07 は add / edit / delete のみ（並び替えは後続工程）。
// URL へは一切アクセスしない（プレビューも favicon も取得しない）。
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import type { NatoriProjectReferenceLinkView } from "@/features/natori/types/projects";

const ENDPOINT = "/api/natori/admin/project-links";

/** 外部へ出す error code。DB 内部情報は含まない。 */
export type NatoriReferenceLinkErrorCode =
  | "invalid_request"
  | "unsupported_action"
  | "unauthorized"
  | "not_found"
  | "project_archived"
  | "link_limit_exceeded"
  | "duplicate_link"
  | "temporarily_unavailable";

export class NatoriReferenceLinkError extends Error {
  readonly code: NatoriReferenceLinkErrorCode;
  constructor(code: NatoriReferenceLinkErrorCode) {
    super(code);
    this.name = "NatoriReferenceLinkError";
    this.code = code;
  }
}

const ERROR_MESSAGES: Record<NatoriReferenceLinkErrorCode, string> = {
  invalid_request: "URLの形式が正しくありません（https:// で始まるURLのみ）。",
  unsupported_action: "この操作は現在サポートされていません。",
  unauthorized: "権限がありません。ログイン状態をご確認ください。",
  not_found: "対象のリンクが見つかりませんでした。画面を再読み込みしてください。",
  project_archived: "アーカイブ済みの案件のリンクは変更できません。",
  link_limit_exceeded: "外部リンクは1案件あたり最大5件までです。",
  duplicate_link: "同じURLが既に登録されています。",
  temporarily_unavailable: "一時的に保存できませんでした。時間をおいてお試しください。",
};

export function describeNatoriReferenceLinkError(error: unknown): string {
  if (error instanceof NatoriReferenceLinkError) return ERROR_MESSAGES[error.code];
  return ERROR_MESSAGES.temporarily_unavailable;
}

type LinkResponse = {
  ok?: boolean;
  error?: string;
  links?: NatoriProjectReferenceLinkView[];
};

async function readLinks(response: Response): Promise<NatoriProjectReferenceLinkView[]> {
  const body = (await response.json().catch(() => null)) as LinkResponse | null;
  if (!response.ok || !body?.ok) {
    const code = (body?.error ?? "temporarily_unavailable") as NatoriReferenceLinkErrorCode;
    throw new NatoriReferenceLinkError(
      code in ERROR_MESSAGES ? code : "temporarily_unavailable"
    );
  }
  return body.links ?? [];
}

export async function fetchNatoriProjectReferenceLinks(
  projectId: string
): Promise<NatoriProjectReferenceLinkView[]> {
  const response = await fetch(
    `${ENDPOINT}?projectId=${encodeURIComponent(projectId)}`,
    { cache: "no-store" }
  );
  return readLinks(response);
}

export async function addNatoriProjectReferenceLink(
  projectId: string,
  url: string,
  label: string | null
): Promise<NatoriProjectReferenceLinkView[]> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, url, label }),
  });
  return readLinks(response);
}

export async function updateNatoriProjectReferenceLink(
  projectId: string,
  linkId: string,
  url: string,
  label: string | null
): Promise<NatoriProjectReferenceLinkView[]> {
  const response = await fetch(ENDPOINT, {
    method: "PATCH",
    headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, linkId, url, label }),
  });
  return readLinks(response);
}

export async function deleteNatoriProjectReferenceLink(
  projectId: string,
  linkId: string
): Promise<NatoriProjectReferenceLinkView[]> {
  const response = await fetch(
    `${ENDPOINT}?projectId=${encodeURIComponent(projectId)}&linkId=${encodeURIComponent(linkId)}`,
    { method: "DELETE", headers: { ...CSRF_HEADERS } }
  );
  return readLinks(response);
}
