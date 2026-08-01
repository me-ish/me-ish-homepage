// api/natori/admin/project-links/route.ts
// 案件の外部参照リンク CRUD。業務ロジックは projectReferenceLinksService に集約。
//
// 既存 admin API と同じ認証（canUseNatoriManagement）と CSRF を使い、
// owner scope / archive guard は service 側で担保する。
// URL へは一切アクセスしない（fetch / metadata / OGP / redirect 追跡なし）。
import { NextResponse } from "next/server";
import { checkCsrf } from "@/lib/auth/csrf";
import { checkSameOrigin } from "@/lib/auth/origin";
import { canUseNatoriManagement } from "@/features/natori/server/requireNatoriAdmin";
import {
  addNatoriProjectReferenceLink,
  deleteNatoriProjectReferenceLink,
  listNatoriProjectReferenceLinks,
  reorderNatoriProjectReferenceLinks,
  updateNatoriProjectReferenceLink,
  type ReferenceLinkServiceResult,
} from "@/features/natori/server/projectReferenceLinksService";
import { NATORI_PROJECT_REFERENCE_LINK_MAX } from "@/features/natori/lib/projectReferenceLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** service の結果を、DB 内部情報を含まない外部 error code へ写す。 */
function respond(result: ReferenceLinkServiceResult) {
  switch (result.kind) {
    case "ok":
      return NextResponse.json({ ok: true, links: result.links });
    case "not-found":
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "project-archived":
      return NextResponse.json({ error: "project_archived" }, { status: 409 });
    case "link-limit-exceeded":
      return NextResponse.json(
        { error: "link_limit_exceeded", limit: NATORI_PROJECT_REFERENCE_LINK_MAX },
        { status: 409 }
      );
    case "duplicate-link":
      return NextResponse.json({ error: "duplicate_link" }, { status: 409 });
    case "invalid-link":
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    case "db-error":
      return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}

async function guard(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const originError = checkSameOrigin(request);
  if (originError) return originError;
  const csrfError = checkCsrf(request);
  if (csrfError) return csrfError;
  return null;
}

export async function GET(request: Request) {
  if (!(await canUseNatoriManagement())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  return respond(await listNatoriProjectReferenceLinks(projectId));
}

export async function POST(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  // 原回答は管理操作から変更できない。含まれていたら黙って無視せず拒否する。
  if ("requestData" in payload || "request_data" in payload) {
    return NextResponse.json({ error: "immutable_field" }, { status: 400 });
  }

  const projectId = readString(payload.projectId);
  const url = readString(payload.url);
  if (!projectId || !url) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const label = typeof payload.label === "string" ? payload.label : null;

  return respond(await addNatoriProjectReferenceLink({ projectId, url, label }));
}

export async function PATCH(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const payload = (await request.json().catch(() => null)) as unknown;
  if (!isObject(payload)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if ("requestData" in payload || "request_data" in payload) {
    return NextResponse.json({ error: "immutable_field" }, { status: 400 });
  }

  const projectId = readString(payload.projectId);
  if (!projectId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (payload.kind === "reorder") {
    const orderedIds = Array.isArray(payload.orderedIds)
      ? payload.orderedIds.filter((id): id is string => typeof id === "string")
      : null;
    if (!orderedIds || orderedIds.length !== (payload.orderedIds as unknown[]).length) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    return respond(await reorderNatoriProjectReferenceLinks(projectId, orderedIds));
  }

  const linkId = readString(payload.linkId);
  const url = readString(payload.url);
  if (!linkId || !url) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const label = typeof payload.label === "string" ? payload.label : null;

  return respond(
    await updateNatoriProjectReferenceLink({ projectId, linkId, url, label })
  );
}

export async function DELETE(request: Request) {
  const blocked = await guard(request);
  if (blocked) return blocked;

  const params = new URL(request.url).searchParams;
  const projectId = params.get("projectId");
  const linkId = params.get("linkId");
  if (!projectId || !linkId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  return respond(await deleteNatoriProjectReferenceLink(projectId, linkId));
}
