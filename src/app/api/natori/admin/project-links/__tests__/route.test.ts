// link CRUD route の認可・CSRF・origin・error 分類。
// DB 内部情報や Storage path を外へ出さないことを固定する。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  mockCanUse,
  mockList,
  mockAdd,
  mockUpdate,
  mockDelete,
  mockReorder,
} = vi.hoisted(() => ({
  mockCanUse: vi.fn(),
  mockList: vi.fn(),
  mockAdd: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockReorder: vi.fn(),
}));

vi.mock("@/features/natori/server/requireNatoriAdmin", () => ({
  canUseNatoriManagement: (...args: unknown[]) => mockCanUse(...args),
}));

vi.mock("@/features/natori/server/projectReferenceLinksService", () => ({
  listNatoriProjectReferenceLinks: (...args: unknown[]) => mockList(...args),
  addNatoriProjectReferenceLink: (...args: unknown[]) => mockAdd(...args),
  updateNatoriProjectReferenceLink: (...args: unknown[]) => mockUpdate(...args),
  deleteNatoriProjectReferenceLink: (...args: unknown[]) => mockDelete(...args),
  reorderNatoriProjectReferenceLinks: (...args: unknown[]) => mockReorder(...args),
}));

import { DELETE, GET, PATCH, POST } from "../route";

const BASE = "https://example.com/api/natori/admin/project-links";
const CSRF = { "x-requested-with": "me-ish", "content-type": "application/json" };
const PROJECT_ID = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";

const OK_LINKS = [
  {
    id: "link-1",
    url: "https://example.com/a",
    label: "資料",
    sortOrder: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

function jsonReq(
  method: string,
  body: unknown,
  headers: Record<string, string> = CSRF
) {
  return new Request(BASE, { method, headers, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCanUse.mockResolvedValue(true);
  for (const mock of [mockList, mockAdd, mockUpdate, mockDelete, mockReorder]) {
    mock.mockResolvedValue({ kind: "ok", links: OK_LINKS });
  }
});

describe("認可・security", () => {
  it("管理権限が無ければ 401 で service を呼ばない", async () => {
    mockCanUse.mockResolvedValue(false);
    const res = await POST(jsonReq("POST", { projectId: PROJECT_ID, url: "https://a.example" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("CSRF ヘッダーが無ければ 403", async () => {
    const res = await POST(
      jsonReq("POST", { projectId: PROJECT_ID, url: "https://a.example" }, {
        "content-type": "application/json",
      })
    );
    expect(res.status).toBe(403);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("Origin が配信ホストと異なれば 403", async () => {
    const res = await POST(
      jsonReq("POST", { projectId: PROJECT_ID, url: "https://a.example" }, {
        ...CSRF,
        origin: "https://evil.example",
      })
    );
    expect(res.status).toBe(403);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("GET は projectId 必須", async () => {
    const res = await GET(new Request(BASE));
    expect(res.status).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
  });
});

describe("request_data immutability", () => {
  it.each([
    ["POST", "requestData"],
    ["POST", "request_data"],
    ["PATCH", "requestData"],
    ["PATCH", "request_data"],
  ])("%s に %s が含まれていたら 400 で拒否する", async (method, field) => {
    const body = {
      projectId: PROJECT_ID,
      linkId: "link-1",
      url: "https://example.com/a",
      [field]: { schemaVersion: 1 },
    };
    const res =
      method === "POST"
        ? await POST(jsonReq("POST", body))
        : await PATCH(jsonReq("PATCH", body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("immutable_field");
    expect(mockAdd).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("CRUD", () => {
  it("追加は url / label を service へ渡す", async () => {
    const res = await POST(
      jsonReq("POST", { projectId: PROJECT_ID, url: " https://example.com/a ", label: "資料" })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, links: OK_LINKS });
    expect(mockAdd).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      url: "https://example.com/a",
      label: "資料",
    });
  });

  it("編集は linkId / url / label を渡す", async () => {
    await PATCH(
      jsonReq("PATCH", {
        projectId: PROJECT_ID,
        linkId: "link-1",
        url: "https://example.com/b",
        label: null,
      })
    );
    expect(mockUpdate).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      linkId: "link-1",
      url: "https://example.com/b",
      label: null,
    });
  });

  it("並び替えは orderedIds を渡す", async () => {
    await PATCH(
      jsonReq("PATCH", {
        kind: "reorder",
        projectId: PROJECT_ID,
        orderedIds: ["link-2", "link-1"],
      })
    );
    expect(mockReorder).toHaveBeenCalledWith(PROJECT_ID, ["link-2", "link-1"]);
  });

  it("削除は query から projectId / linkId を取る", async () => {
    const res = await DELETE(
      new Request(`${BASE}?projectId=${PROJECT_ID}&linkId=link-1`, {
        method: "DELETE",
        headers: CSRF,
      })
    );
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith(PROJECT_ID, "link-1");
  });

  it("orderedIds に文字列以外が混ざれば 400", async () => {
    const res = await PATCH(
      jsonReq("PATCH", { kind: "reorder", projectId: PROJECT_ID, orderedIds: ["a", 1] })
    );
    expect(res.status).toBe(400);
    expect(mockReorder).not.toHaveBeenCalled();
  });
});

describe("error 分類", () => {
  it.each([
    ["not-found", 404, "not_found"],
    ["project-archived", 409, "project_archived"],
    ["link-limit-exceeded", 409, "link_limit_exceeded"],
    ["duplicate-link", 409, "duplicate_link"],
    ["invalid-link", 400, "invalid_request"],
    ["db-error", 503, "temporarily_unavailable"],
  ])("service の %s を %i %s へ写す", async (kind, status, code) => {
    mockAdd.mockResolvedValue({ kind });
    const res = await POST(
      jsonReq("POST", { projectId: PROJECT_ID, url: "https://example.com/a" })
    );
    expect(res.status).toBe(status);
    expect((await res.json()).error).toBe(code);
  });

  it("DB 内部情報や Storage path を返さない", async () => {
    mockAdd.mockResolvedValue({ kind: "db-error" });
    const res = await POST(
      jsonReq("POST", { projectId: PROJECT_ID, url: "https://example.com/a" })
    );
    const body = JSON.stringify(await res.json());
    expect(body).toBe(JSON.stringify({ error: "temporarily_unavailable" }));
    expect(body).not.toContain("natori_project_reference_links");
    expect(body).not.toContain(".webp");
    expect(body).not.toContain("23505");
  });
});
