import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { mockReferenceIn, mockRpc } = vi.hoisted(() => ({
  mockReferenceIn: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: vi.fn(() => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: (...args: unknown[]) => mockReferenceIn(...args),
      })),
    })),
  })),
}));

import {
  confirmNatoriProjectTypeViaRpc,
  createNatoriIntakeViaRpc,
  findLinkedNatoriIntakeReferencePaths,
} from "@/features/natori/server/intakeRpcAdapter";

const PROJECT_ID = "2ef91cb1-e0a3-4f32-b846-a0d8c6bbf44c";
const OWNER_ID = "a2823bd4-9b9a-4ae0-b408-e2d131c2ba09";
const REFERENCE_PATH = `${PROJECT_ID}/b65e16de-13c8-4bf6-a830-87f466815dba.webp`;

beforeEach(() => {
  vi.clearAllMocks();
  mockReferenceIn.mockResolvedValue({ data: [], error: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNatoriIntakeViaRpc", () => {
  it("calls the versioned RPC with the exact envelope and parses its UUID", async () => {
    mockRpc.mockResolvedValue({
      data: [{ project_id: PROJECT_ID, created_at: "2026-07-31T12:00:00Z" }],
      error: null,
    });
    const requestData = { schemaVersion: 1, inquiryMode: "consultation" };
    const referenceLinks = [
      {
        url: "https://example.com/a#preview",
        normalized_url: "https://example.com/a",
        label: null,
        provider: null,
        sort_order: 0,
      },
    ];

    await expect(
      createNatoriIntakeViaRpc({
        ownerId: OWNER_ID,
        projectId: PROJECT_ID,
        clientName: "依頼者",
        clientEmail: "client@example.com",
        requestData,
        referenceFiles: [REFERENCE_PATH],
        referenceLinks,
      }),
    ).resolves.toEqual({
      kind: "ok",
      projectId: PROJECT_ID,
      createdAt: "2026-07-31T12:00:00Z",
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "natori_create_project_with_tasks_v2",
      {
        p_user_id: OWNER_ID,
        p_project_id: PROJECT_ID,
        p_client_name: "依頼者",
        p_client_email: "client@example.com",
        p_request_data: requestData,
        p_reference_files: [REFERENCE_PATH],
        p_reference_links: referenceLinks,
      },
    );
  });

  it("distinguishes a definite RPC rejection from an ambiguous outcome", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { code: "PGRST_TEST", message: "failed" },
      status: 400,
    });
    const input = {
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      clientName: "依頼者",
      clientEmail: "client@example.com",
      requestData: {},
      referenceFiles: [],
      referenceLinks: [],
    };
    await expect(createNatoriIntakeViaRpc(input)).resolves.toEqual({
      kind: "rejected",
    });
    expect(console.error).toHaveBeenCalledWith(
      "[natori-intake-rpc] create failed status=400 code=PGRST_TEST",
    );
    expect(mockRpc).toHaveBeenCalledTimes(1);

    mockRpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "network failure" },
        status: 0,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "retry failed" } });
    await expect(createNatoriIntakeViaRpc(input)).resolves.toEqual({
      kind: "unknown",
    });
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });

  it("retries the same idempotency key after a lost response", async () => {
    const input = {
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      clientName: "依頼者",
      clientEmail: "client@example.com",
      requestData: {},
      referenceFiles: [],
      referenceLinks: [],
    };
    mockRpc
      .mockRejectedValueOnce(new Error("response lost after commit"))
      .mockResolvedValueOnce({
        data: [{ project_id: PROJECT_ID, created_at: "2026-07-31T12:00:00Z" }],
        error: null,
      });
    await expect(createNatoriIntakeViaRpc(input)).resolves.toEqual({
      kind: "ok",
      projectId: PROJECT_ID,
      createdAt: "2026-07-31T12:00:00Z",
    });
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc.mock.calls[0]).toEqual(mockRpc.mock.calls[1]);
  });

  it("does not accept a malformed or mismatched success response", async () => {
    const input = {
      ownerId: OWNER_ID,
      projectId: PROJECT_ID,
      clientName: "依頼者",
      clientEmail: "client@example.com",
      requestData: {},
      referenceFiles: [],
      referenceLinks: [],
    };
    mockRpc
      .mockResolvedValueOnce({
        data: [{ project_id: "not-a-uuid" }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            project_id: "ba24cb61-b3ff-4584-87f9-d549bc3af77d",
            created_at: "2026-07-31T12:00:00Z",
          },
        ],
        error: null,
      });
    await expect(createNatoriIntakeViaRpc(input)).resolves.toEqual({
      kind: "unknown",
    });
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

describe("findLinkedNatoriIntakeReferencePaths", () => {
  it("returns only confirmed linked paths and treats read failures as unknown", async () => {
    mockReferenceIn.mockResolvedValueOnce({
      data: [{ storage_path: REFERENCE_PATH }],
      error: null,
    });
    await expect(
      findLinkedNatoriIntakeReferencePaths([REFERENCE_PATH]),
    ).resolves.toEqual({ kind: "ok", linkedPaths: [REFERENCE_PATH] });

    mockReferenceIn.mockResolvedValueOnce({
      data: null,
      error: { message: "network failure" },
    });
    await expect(
      findLinkedNatoriIntakeReferencePaths([REFERENCE_PATH]),
    ).resolves.toEqual({ kind: "unknown" });
  });
});

describe("confirmNatoriProjectTypeViaRpc", () => {
  const input = {
    ownerId: OWNER_ID,
    projectId: PROJECT_ID,
    projectType: "icon" as const,
  };

  it.each([
    ["confirmed", "confirmed", PROJECT_ID, "icon", 6],
    ["already_confirmed", "already-confirmed", PROJECT_ID, "icon", 6],
    ["not_found", "not-found", null, null, 0],
    ["conflict", "conflict", PROJECT_ID, "undecided", 1],
    ["invalid_type", "invalid-type", null, null, 0],
  ] as const)(
    "parses %s as %s",
    async (rpcResult, expected, projectId, projectType, taskCount) => {
      mockRpc.mockResolvedValue({
        data: [
          {
            result: rpcResult,
            project_id: projectId,
            project_type: projectType,
            task_count: taskCount,
          },
        ],
        error: null,
      });
      await expect(confirmNatoriProjectTypeViaRpc(input)).resolves.toEqual({
        kind: expected,
        projectId,
        projectType,
        taskCount,
      });
    },
  );

  it("calls the confirm RPC with the owner and concrete type", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          result: "confirmed",
          project_id: PROJECT_ID,
          project_type: "icon",
          task_count: 6,
        },
      ],
      error: null,
    });
    await confirmNatoriProjectTypeViaRpc(input);
    expect(mockRpc).toHaveBeenCalledWith("natori_confirm_project_type_v1", {
      p_user_id: OWNER_ID,
      p_project_id: PROJECT_ID,
      p_type: "icon",
    });
  });

  it("returns db-error for RPC errors and unknown outcomes", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "failed" } });
    await expect(confirmNatoriProjectTypeViaRpc(input)).resolves.toEqual({
      kind: "db-error",
    });

    mockRpc.mockRejectedValueOnce(new Error("network failure"));
    await expect(confirmNatoriProjectTypeViaRpc(input)).resolves.toEqual({
      kind: "db-error",
    });

    mockRpc.mockResolvedValueOnce({
      data: [{ result: "unexpected" }],
      error: null,
    });
    await expect(confirmNatoriProjectTypeViaRpc(input)).resolves.toEqual({
      kind: "db-error",
    });
  });

  it("rejects a success row that does not match the requested project/template", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          result: "confirmed",
          project_id: PROJECT_ID,
          project_type: "icon",
          task_count: 5,
        },
      ],
      error: null,
    });
    await expect(confirmNatoriProjectTypeViaRpc(input)).resolves.toEqual({
      kind: "db-error",
    });
  });
});
