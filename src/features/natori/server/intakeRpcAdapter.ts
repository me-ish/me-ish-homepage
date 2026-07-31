import "server-only";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  NatoriConcreteProjectType,
  NatoriProjectType,
} from "@/features/natori/types/projects";

type IntakeRpcName =
  | "natori_create_project_with_tasks_v2"
  | "natori_confirm_project_type_v1";

type IntakeRpcResponse = {
  data: unknown;
  error: unknown;
  status?: number;
};

type IntakeRpcClient = {
  rpc(
    name: IntakeRpcName,
    args: Record<string, unknown>,
  ): PromiseLike<IntakeRpcResponse>;
};

function getIntakeRpcClient(): IntakeRpcClient {
  // TODO(P1-11): remove this narrow bridge after the canonical generated
  // Database type contains both versioned intake RPCs.
  return supabaseAdmin() as unknown as IntakeRpcClient;
}

export type NatoriIntakeReferenceLinkRow = {
  url: string;
  normalized_url: string;
  label: string | null;
  provider: string | null;
  sort_order: number;
};

export type CreateNatoriIntakeRpcInput = {
  ownerId: string;
  projectId: string;
  clientName: string;
  clientEmail: string;
  requestData: unknown;
  referenceFiles: string[];
  referenceLinks: NatoriIntakeReferenceLinkRow[];
};

export type CreateNatoriIntakeRpcResult =
  | { kind: "ok"; projectId: string; createdAt: string }
  | { kind: "rejected" }
  | { kind: "unknown" };

const createResultSchema = z.strictObject({
  project_id: z.uuid(),
  created_at: z.iso.datetime({ offset: true }),
});

function isDefiniteCreateRejection(error: unknown, status: number | undefined): boolean {
  if (!error || status === undefined) return false;
  return status >= 400 && status < 500 && status !== 408;
}

function readCreateResult(
  data: unknown,
): { projectId: string; createdAt: string } | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const parsed = createResultSchema.safeParse(data[0]);
  return parsed.success
    ? { projectId: parsed.data.project_id, createdAt: parsed.data.created_at }
    : null;
}

async function attemptCreateNatoriIntakeViaRpc(
  input: CreateNatoriIntakeRpcInput,
): Promise<CreateNatoriIntakeRpcResult> {
  try {
    const { data, error, status } = await getIntakeRpcClient().rpc(
      "natori_create_project_with_tasks_v2",
      {
        p_user_id: input.ownerId,
        p_project_id: input.projectId,
        p_client_name: input.clientName,
        p_client_email: input.clientEmail,
        p_request_data: input.requestData,
        p_reference_files: input.referenceFiles,
        p_reference_links: input.referenceLinks,
      },
    );
    if (error) {
      console.error("[natori-intake-rpc] create failed");
      return isDefiniteCreateRejection(error, status)
        ? { kind: "rejected" }
        : { kind: "unknown" };
    }
    const result = readCreateResult(data);
    return result?.projectId === input.projectId
      ? { kind: "ok", ...result }
      : { kind: "unknown" };
  } catch {
    console.error("[natori-intake-rpc] create threw");
    return { kind: "unknown" };
  }
}

export type NatoriIntakeReferenceLookupResult =
  | { kind: "ok"; linkedPaths: string[] }
  | { kind: "unknown" };

const linkedReferenceRowsSchema = z.array(
  z.object({ storage_path: z.string() })
);

export async function findLinkedNatoriIntakeReferencePaths(
  referencePaths: string[],
): Promise<NatoriIntakeReferenceLookupResult> {
  if (referencePaths.length === 0) return { kind: "ok", linkedPaths: [] };
  try {
    const { data, error } = await supabaseAdmin()
      .from("natori_inquiry_reference_files")
      .select("storage_path")
      .in("storage_path", referencePaths);
    if (error) {
      console.error("[natori-intake-rpc] reference reconciliation failed");
      return { kind: "unknown" };
    }
    const parsed = linkedReferenceRowsSchema.safeParse(data);
    return parsed.success
      ? {
          kind: "ok",
          linkedPaths: parsed.data.map((row) => row.storage_path),
        }
      : { kind: "unknown" };
  } catch {
    console.error("[natori-intake-rpc] reference reconciliation threw");
    return { kind: "unknown" };
  }
}

export async function createNatoriIntakeViaRpc(
  input: CreateNatoriIntakeRpcInput,
): Promise<CreateNatoriIntakeRpcResult> {
  const firstAttempt = await attemptCreateNatoriIntakeViaRpc(input);
  if (firstAttempt.kind !== "unknown") return firstAttempt;

  // The project UUID is a submission idempotency key. Retrying the exact
  // envelope resolves a response that may have been lost after commit without
  // creating a second project. If the retry is also inconclusive, callers must
  // retain Storage objects for orphan reconciliation instead of deleting bytes
  // that a committed row may reference.
  const retry = await attemptCreateNatoriIntakeViaRpc(input);
  return retry.kind === "ok" ? retry : { kind: "unknown" };
}

export type ConfirmNatoriProjectTypeRpcInput = {
  ownerId: string;
  projectId: string;
  projectType: NatoriConcreteProjectType;
};

export type ConfirmNatoriProjectTypeRpcResult =
  | {
      kind: "confirmed" | "already-confirmed";
      projectId: string;
      projectType: NatoriConcreteProjectType;
      taskCount: number;
    }
  | {
      kind: "conflict";
      projectId: string;
      projectType: NatoriProjectType;
      taskCount: number;
    }
  | {
      kind: "not-found" | "invalid-type";
      projectId: null;
      projectType: null;
      taskCount: 0;
    }
  | { kind: "db-error" };

const confirmResultSchema = z.strictObject({
  result: z.enum([
    "confirmed",
    "already_confirmed",
    "not_found",
    "conflict",
    "invalid_type",
  ]),
  project_id: z.uuid().nullable(),
  project_type: z
    .enum(["undecided", "icon", "sd", "standing", "illustration"])
    .nullable(),
  task_count: z.number().int().nonnegative(),
});

function readConfirmResult(
  data: unknown,
  expectedProjectId: string,
  expectedProjectType: NatoriConcreteProjectType,
): Exclude<ConfirmNatoriProjectTypeRpcResult, { kind: "db-error" }> | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const parsed = confirmResultSchema.safeParse(data[0]);
  if (!parsed.success) return null;
  const row = parsed.data;

  switch (row.result) {
    case "confirmed":
    case "already_confirmed":
      if (
        row.project_id !== expectedProjectId ||
        row.project_type !== expectedProjectType ||
        row.task_count !== 6
      ) {
        return null;
      }
      return {
        kind: row.result === "confirmed" ? "confirmed" : "already-confirmed",
        projectId: row.project_id,
        projectType: row.project_type,
        taskCount: row.task_count,
      };
    case "conflict":
      if (row.project_id !== expectedProjectId || !row.project_type) return null;
      return {
        kind: "conflict",
        projectId: row.project_id,
        projectType: row.project_type,
        taskCount: row.task_count,
      };
    case "not_found":
    case "invalid_type":
      if (
        row.project_id !== null ||
        row.project_type !== null ||
        row.task_count !== 0
      ) {
        return null;
      }
      return {
        kind: row.result === "not_found" ? "not-found" : "invalid-type",
        projectId: null,
        projectType: null,
        taskCount: 0,
      };
  }
}

export async function confirmNatoriProjectTypeViaRpc(
  input: ConfirmNatoriProjectTypeRpcInput,
): Promise<ConfirmNatoriProjectTypeRpcResult> {
  try {
    const { data, error } = await getIntakeRpcClient().rpc(
      "natori_confirm_project_type_v1",
      {
        p_user_id: input.ownerId,
        p_project_id: input.projectId,
        p_type: input.projectType,
      },
    );
    if (error) {
      console.error("[natori-intake-rpc] confirm-type failed");
      return { kind: "db-error" };
    }
    return (
      readConfirmResult(data, input.projectId, input.projectType) ?? {
        kind: "db-error",
      }
    );
  } catch {
    console.error("[natori-intake-rpc] confirm-type threw");
    return { kind: "db-error" };
  }
}
