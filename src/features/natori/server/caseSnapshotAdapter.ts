import "server-only";
import { z } from "zod";
import type { CaseSnapshot } from "../types/caseReadModel";
import { adaptCaseFinancial } from "./caseSnapshotFinancial";
import { adaptCaseLifecycle } from "./caseSnapshotLifecycle";
import {
  compareSourceTimes, incompleteSource, readySource, sourceFact, sourceFailure, sourceId, sourceOccurred,
  sourceRows, sourceTime, type CaseRelation, type CaseSourceContext,
} from "./caseSnapshotSource";

const intakeSchema = z.object({
  id: sourceId, project_id: sourceId,
  status: z.enum(["processing", "completed", "failed", "needs_review"]),
  created_at: sourceTime, updated_at: sourceTime,
});

const registrationSchema=z.object({id:sourceId,project_id:sourceId,
 origin:z.enum(["internal","external","manual","historical","unknown"]),created_at:sourceTime});

export const PROJECT_RELATIONS: readonly CaseRelation[] = [{
  name: "project_intake",
  select: `SELECT o.operation_id::text AS id, o.project_id::text AS project_id,
    o.status, o.created_at, o.updated_at
    FROM public.natori_intake_operations o
    JOIN authorized_case p ON o.project_id = p.id AND o.owner_id = p.user_id`,
}, {name:"project_registration",select:`select w.id::text,w.project_id::text,w.data->>'origin' as origin,w.created_at
 from public.natori_case_work_records w join authorized_case p on p.id=w.project_id and p.user_id=w.owner_id where w.kind='origin'`}];

function adaptProject(context: CaseSourceContext): CaseSnapshot["project"] {
  const p = context.project;
  const intake = sourceRows(context, "project_intake", intakeSchema);
  const registration=sourceRows(context,"project_registration",registrationSchema);
  if(registration.state!=="ready")return sourceFailure(registration);
  if(registration.rows.length>1||registration.rows.some(r=>!sourceOccurred(context,r.created_at)))return incompleteSource();
  if (intake.state !== "ready") return sourceFailure(intake);
  if (intake.rows.length > 1 || intake.rows.some(row =>
    !sourceOccurred(context, row.created_at) || !sourceOccurred(context, row.updated_at)
    || compareSourceTimes(row.updated_at, row.created_at) < 0)) return incompleteSource();
  // A missing origin discriminator is not evidence for internal/legacy/external.
  // Only the atomic public-intake completion currently supplies positive evidence.
  if (intake.rows.length === 1 && intake.rows[0].status !== "completed") {
    return { state: "unavailable", reason: "unsupported" };
  }
  const value = {
    rawStatus: p.status, type: p.type, archivedAt: p.deleted_at,
    origin: intake.rows.length === 1 ? "internal" as const : registration.rows[0]?.origin === "manual" ? "external" as const : registration.rows[0]?.origin??"unknown" as const,
    administrativeAmount: p.amount === null ? null : { amount: p.amount, currency: "JPY" },
  };
  return readySource(context, { ...sourceFact(context, p.id, p.updated_at, {
    ...value, originEvidence: intake.rows[0] ?? registration.rows[0] ?? null,
  },intake.rows.length===1?"ledger":registration.rows.length?registration.rows[0].origin==="historical"?"historical_registration":"manual_record":"ledger"), ...value });
}

/**
 * Pure normalization of an already authorized, coherent source envelope.
 * Callers must use readCaseManagement for authorization; this adapter never reads
 * services, infers facts from labels, or turns omitted domains into absence.
 */
export function adaptCaseSnapshot(context: CaseSourceContext): CaseSnapshot {
  return {
    projectId: context.project.id, snapshotId: context.snapshotId, asOf: context.observedAt,
    project: adaptProject(context), ...adaptCaseFinancial(context), ...adaptCaseLifecycle(context),
    externalEvidence: { state: "unsupported" },
  };
}
