import "server-only";
import {createHash} from "node:crypto";
import { z } from "zod";
import { deriveCaseReadModel } from "../lib/caseReadModel";
import type { CaseReadModel } from "../types/caseReadModel";
import type { CaseDisplayEvidence } from "../types/caseWorkspace";
import { adaptCaseDisplayEvidence } from "./caseDisplayEvidence";
import { NatoriManagementError, resolveNatoriManagementContext } from "./natoriOwner";
import { CASE_MANAGEMENT_SECTIONS, CASE_MANAGEMENT_SQL } from "./caseManagementQuery";
import { adaptCaseSnapshot } from "./caseSnapshotAdapter";
import { compareSourceTimes, sourceId, sourceOccurred, sourceProjectSchema, sourceTime } from "./caseSnapshotSource";

/** Trusted server transport, intentionally unbound to any production connection. */
export type CaseReadExecutor = (statement: {
  text: string; values: readonly [projectId: string, ownerId: string];
}) => Promise<{ rows: readonly unknown[] }>;

export type CaseManagementReadResult =
  | { state: "ready"; model: CaseReadModel; display: CaseDisplayEvidence;
      metadata: { title: string | null; clientLabel: string | null; registeredDueDate: string | null } }
  | { state: "not_found" }
  | { state: "unavailable"; reason: "unauthorized" | "owner_unavailable" | "invalid_request"
    | "read_failed" | "incomplete" };

const uuid = z.uuid();
const envelopeSchema = z.object({
  snapshot_id: sourceId,
  observed_at: sourceTime,
  project: sourceProjectSchema,
  sections: z.record(z.string(), z.unknown()),
});

/**
 * Management authorization precedes every data read. Ownership is enforced in
 * SQL and checked again on the envelope before any related facts are adapted.
 * Errors never return raw rows, provider messages, identifiers, or SQL details.
 */
export async function readCaseManagement(
  projectId: string,
  execute: CaseReadExecutor,
): Promise<CaseManagementReadResult> {
  let ownerId: string;
  try {
    ({ ownerId } = await resolveNatoriManagementContext());
  } catch (error) {
    return { state: "unavailable", reason: error instanceof NatoriManagementError
      && error.code === "unauthorized" ? "unauthorized" : "owner_unavailable" };
  }
  if (!uuid.safeParse(projectId).success) return { state: "unavailable", reason: "invalid_request" };
  if (!uuid.safeParse(ownerId).success) return { state: "unavailable", reason: "owner_unavailable" };

  let rows: readonly unknown[];
  try {
    const result = await execute({ text: CASE_MANAGEMENT_SQL, values: [projectId, ownerId] });
    if (!result || !Array.isArray(result.rows)) return { state: "unavailable", reason: "incomplete" };
    rows = result.rows;
  } catch {
    return { state: "unavailable", reason: "read_failed" };
  }
  if (rows.length === 0) return { state: "not_found" };
  if (rows.length !== 1) return { state: "unavailable", reason: "incomplete" };
  const parsed = envelopeSchema.safeParse(rows[0]);
  if (!parsed.success) return { state: "unavailable", reason: "incomplete" };
  const { project, snapshot_id: snapshotId, observed_at: observedAt, sections } = parsed.data;
  if (project.id !== projectId || project.user_id !== ownerId) {
    return { state: "unavailable", reason: "incomplete" };
  }
  if (CASE_MANAGEMENT_SECTIONS.some(name => !Object.hasOwn(sections, name))) {
    return { state: "unavailable", reason: "incomplete" };
  }
  const context = { project, snapshotId, observedAt, sections };
  const times = [project.created_at, project.updated_at, project.deleted_at,
    project.quote_accepted_at, project.payment_confirmed_at, project.paid_at,
    project.delivery_accepted_at, project.completed_at, project.delivered_mail_at];
  if (times.some(time => time !== null && !sourceOccurred(context, time))
    || compareSourceTimes(project.updated_at, project.created_at) < 0) {
    return { state: "unavailable", reason: "incomplete" };
  }
  try {
    const snapshot = adaptCaseSnapshot(context);
    const model=deriveCaseReadModel(snapshot);
    // This display refresh key is opaque, never a writer revision or a capability.
    // Avoid returning a second full canonical copy of every fact in collection JSON.
    model.fingerprint="case-sha256:"+createHash("sha256").update(model.fingerprint).digest("hex");
    return { state: "ready", model, display: adaptCaseDisplayEvidence(context, snapshot),
      metadata: { title: project.title ?? null, clientLabel: project.client_name ?? null, registeredDueDate: project.due_date ?? null } };
  } catch {
    return { state: "unavailable", reason: "incomplete" };
  }
}
