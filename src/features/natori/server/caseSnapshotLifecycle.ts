import "server-only";
import { z } from "zod";
import type { CaseObservation, CaseSnapshot } from "../types/caseReadModel";
import {
  absentSource, compareSourceTimes, incompleteSource, readySource, sameSourceTime, sourceFact, sourceFailure, sourceId,
  sourceMoney, sourceOccurred, sourceRows, sourceTime, sourceTimestamp,
  type CaseRelation, type CaseSourceContext,
} from "./caseSnapshotSource";

/**
 * Only these fixed, owner-scoped projections enter the adapter. Manifest paths,
 * names and content types are compared inside SQL, never returned to the reader.
 */
export const LIFECYCLE_RELATIONS: CaseRelation[] = [
  { name: "lifecycle_tasks", select: `
    select t.id::text, t.project_id::text, t.task_key, t.stage, t.done, t.sort_order
    from public.natori_project_tasks t join authorized_case p on p.id=t.project_id` },
  { name: "lifecycle_files", select: `
    select f.id::text, f.project_id::text, f.folder, f.state, f.size_bytes,
      f.storage_version, f.verified_at, f.deleted_at, f.created_at,
      coalesce(length(f.content_type)>0,false) as content_type_valid
    from public.natori_delivery_files f join authorized_case p on p.id=f.project_id` },
  { name: "lifecycle_roughs", select: `
    select r.id::text, r.project_id::text, r.message_id::text, r.before_quote,
      r.created_at, r.client_ok_at,
      exists(select 1 from public.natori_case_work_records w where w.project_id=p.id and w.kind='revision_open' and w.data->>'roughId'=r.id::text
        and not exists(select 1 from public.natori_case_work_records h where h.project_id=p.id and h.kind='revision_handled' and h.data->>'requestId'=w.id::text)) as revision_pending,
      (select h.data->>'nextRoughId' from public.natori_case_work_records h join public.natori_case_work_records o on o.id::text=h.data->>'requestId'
        where h.project_id=p.id and o.project_id=p.id and h.kind='revision_handled' and o.kind='revision_open'
        and o.data->>'roughId'=r.id::text and h.data->>'nextRoughId' is not null limit 1) as superseded_by,
      exists(select 1 from public.natori_consultation_messages m
        where m.id=r.message_id and m.project_id=p.id and m.sender='staff') as message_bound
    from public.natori_talk_roughs r join authorized_case p on p.id=r.project_id` },
  { name: "lifecycle_rough_acknowledgements", select: `
    select a.rough_id::text as id, a.project_id::text, a.owner_id::text,
      a.client_ok_at, a.acknowledged_at
    from public.natori_rough_ok_acknowledgements a join authorized_case p
      on p.id=a.project_id and p.user_id=a.owner_id` },
  { name: "lifecycle_releases", select: `
    select r.id::text, r.project_id::text, r.revision, r.published_at, r.expires_at,
      r.accepted_at, r.legacy,
      exists(select 1 from public.natori_notification_jobs j where j.project_id=p.id and j.purpose='delivery_issue_client'
        and j.snapshot->>'releaseId'=r.id::text and j.case_work_guard is not null) as case_work,
      case when jsonb_typeof(r.manifest)='array' then
        (select jsonb_agg(jsonb_build_object('id',m->'id','size_bytes',m->'sizeBytes',
          'storage_version',m->'storageVersion')) from jsonb_array_elements(r.manifest) m)
        else null end as manifest_files,
      case when jsonb_typeof(r.manifest)='array' then
        jsonb_array_length(r.manifest) between 1 and 10 and not exists(
          select 1 from jsonb_array_elements(r.manifest) m where
            jsonb_typeof(m) is distinct from 'object'
            or jsonb_typeof(m->'id') is distinct from 'string'
            or jsonb_typeof(m->'path') is distinct from 'string'
            or jsonb_typeof(m->'fileName') is distinct from 'string'
            or jsonb_typeof(m->'sizeBytes') is distinct from 'number'
            or jsonb_typeof(m->'contentType') is distinct from 'string'
            or coalesce(length(m->>'contentType'),0)=0
            or jsonb_typeof(m->'storageVersion') is distinct from 'string'
            or coalesce(length(m->>'storageVersion'),0)=0)
        else false end as manifest_shape_valid,
      case when jsonb_typeof(r.manifest)='array' then not exists(
        select 1 from jsonb_array_elements(r.manifest) m where not exists(
          select 1 from public.natori_delivery_files f where f.project_id=p.id
            and f.id::text=m->>'id' and f.folder='final' and f.deleted_at is null
            and f.storage_path=m->>'path' and f.file_name=m->>'fileName'
            and f.size_bytes::text=m->>'sizeBytes' and f.content_type=m->>'contentType'
            and f.storage_version=m->>'storageVersion'))
        else false end as manifest_bindings_valid
    from public.natori_delivery_releases r join authorized_case p on p.id=r.project_id` },
  { name: "lifecycle_extensions", select: `
    select x.id::text, x.project_id::text, x.release_id::text, x.operation_id::text,
      x.previous_expires_at, x.new_expires_at, x.created_at
    from public.natori_delivery_extensions x join authorized_case p on p.id=x.project_id` },
  { name: "lifecycle_consultation", select: `
    select m.id::text, m.project_id::text, m.sender, m.created_at
    from public.natori_consultation_messages m join authorized_case p on p.id=m.project_id` },
];

const identity = { id: sourceId, project_id: sourceId };
const taskSchema = z.object({
  ...identity, task_key: sourceId, stage: z.enum(["material", "rough", "lineart", "coloring", "finish", "delivery"]),
  done: z.boolean(), sort_order: z.number().int(),
});
const fileSchema = z.object({
  ...identity, folder: z.enum(["rough", "final"]),
  state: z.enum(["pending", "ready", "failed", "legacy_unverified", "deleting"]),
  size_bytes: sourceMoney, storage_version: sourceId.nullable(), verified_at: sourceTime.nullable(),
  deleted_at: sourceTime.nullable(), created_at: sourceTime, content_type_valid: z.boolean(),
});
const roughSchema = z.object({
  ...identity, message_id: sourceId, before_quote: z.boolean(), created_at: sourceTime,
  client_ok_at: sourceTime.nullable(), message_bound: z.boolean(),
  revision_pending:z.boolean().optional(),superseded_by:sourceId.nullable().optional(),
});
const acknowledgementSchema = z.object({
  ...identity, owner_id: sourceId, client_ok_at: sourceTime, acknowledged_at: sourceTime,
});
const releaseSchema = z.object({
  ...identity, revision: z.literal(1), published_at: sourceTime, expires_at: sourceTime,
  accepted_at: sourceTime.nullable(), legacy: z.boolean(),
  case_work:z.boolean().optional(),
  // Receipt evidence remains usable even when the independent manifest is invalid.
  manifest_files: z.unknown(), manifest_shape_valid: z.boolean(), manifest_bindings_valid: z.boolean(),
});
const extensionSchema = z.object({
  ...identity, release_id: sourceId, operation_id: sourceId,
  previous_expires_at: sourceTime, new_expires_at: sourceTime, created_at: sourceTime,
});
const messageSchema = z.object({
  ...identity, sender: z.enum(["client", "staff"]), created_at: sourceTime,
});
const manifestSchema = z.array(z.object({
  id: sourceId, size_bytes: sourceMoney.min(1).max(50_000_000), storage_version: sourceId,
})).min(1).max(10);

type Lifecycle = Pick<CaseSnapshot, "production" | "roughs" | "delivery" | "receipt" | "consultation">;
type FileRow = z.infer<typeof fileSchema>;
type ReleaseRow = z.infer<typeof releaseSchema>;
const unsupported = (): CaseObservation<never> => ({ state: "unavailable", reason: "unsupported" });
const notBefore = (later: string, earlier: string): boolean => compareSourceTimes(later, earlier) >= 0;

function validFile(context: CaseSourceContext, file: FileRow): boolean {
  return sourceOccurred(context, file.created_at)
    && (file.verified_at === null || (sourceOccurred(context, file.verified_at) && notBefore(file.verified_at, file.created_at)))
    && (file.deleted_at === null || (sourceOccurred(context, file.deleted_at) && notBefore(file.deleted_at, file.created_at)))
    && (file.state !== "ready" || (file.size_bytes > 0 && file.content_type_valid
      && file.storage_version !== null && file.verified_at !== null));
}

function validRelease(context: CaseSourceContext, release: ReleaseRow): boolean {
  return sourceOccurred(context, release.published_at)
    && (release.accepted_at === null || (sourceOccurred(context, release.accepted_at)
      && (release.legacy || notBefore(release.accepted_at, release.published_at))));
}

/** No clock, I/O, inferred task completion, synthesized origins, or capability data. */
export function adaptCaseLifecycle(context: CaseSourceContext): Lifecycle {
  const tasks = sourceRows(context, "lifecycle_tasks", taskSchema);
  const files = sourceRows(context, "lifecycle_files", fileSchema);
  const roughs = sourceRows(context, "lifecycle_roughs", roughSchema);
  const acknowledgements = sourceRows(context, "lifecycle_rough_acknowledgements", acknowledgementSchema);
  const releases = sourceRows(context, "lifecycle_releases", releaseSchema);
  const extensions = sourceRows(context, "lifecycle_extensions", extensionSchema);
  const messages = sourceRows(context, "lifecycle_consultation", messageSchema);
  const fileRowsValid = files.state === "ready" && files.rows.every(file => validFile(context, file));
  const releaseRowsValid = releases.state === "ready" && releases.rows.length <= 1
    && releases.rows.every(release => validRelease(context, release));

  const production = (): Lifecycle["production"] => {
    if (tasks.state !== "ready") return sourceFailure(tasks);
    if (files.state !== "ready") return sourceFailure(files);
    if (!fileRowsValid || new Set(tasks.rows.map(task => task.task_key)).size !== tasks.rows.length) return incompleteSource();
    // Tasks have no recorded/updated timestamp. Do not invent CaseFact.recordedAt.
    return tasks.rows.length === 0 && files.rows.length === 0 ? absentSource(context) : unsupported();
  };

  const adaptRoughs = (): Lifecycle["roughs"] => {
    if (roughs.state !== "ready") return sourceFailure(roughs);
    if (acknowledgements.state !== "ready") return sourceFailure(acknowledgements);
    if (new Set(roughs.rows.map(rough => rough.message_id)).size !== roughs.rows.length) return incompleteSource();
    const byId = new Map(roughs.rows.map(rough => [rough.id, rough]));
    const ackById = new Map(acknowledgements.rows.map(ack => [ack.id, ack]));
    for (const ack of acknowledgements.rows) {
      const rough = byId.get(ack.id);
      if (!rough || ack.owner_id !== context.project.user_id || rough.client_ok_at === null
        || !sameSourceTime(ack.client_ok_at, rough.client_ok_at) || !sourceOccurred(context, ack.acknowledged_at)
        || !notBefore(ack.acknowledged_at, ack.client_ok_at)) return incompleteSource();
    }
    if (roughs.rows.some(rough => !rough.message_bound || !sourceOccurred(context, rough.created_at)
      || (rough.client_ok_at !== null && (!sourceOccurred(context, rough.client_ok_at)
        || !notBefore(rough.client_ok_at, rough.created_at))))) return incompleteSource();
    if (roughs.rows.length === 0) return absentSource(context);
    return readySource(context, [...roughs.rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(rough => {
      const ack = ackById.get(rough.id);
      const value = { beforeQuote: rough.before_quote, clientOkAt: rough.client_ok_at === null ? null : sourceTimestamp(rough.client_ok_at),
        acknowledgedAt: ack ? sourceTimestamp(ack.acknowledged_at) : null,
        ...(rough.revision_pending?{revisionPending:true}:{}),...(rough.superseded_by?{supersededBy:rough.superseded_by}:{}) };
      const fact = sourceFact(context, rough.id, sourceTimestamp(rough.created_at), { messageId: rough.message_id, ...value });
      // The reducer also uses this revision as the immutable OK notification target.
      // Acknowledgement changes remain visible in readySource's observation revision.
      return { ...fact, revision: value.clientOkAt ?? fact.revision, ...value };
    }));
  };

  const delivery = (): Lifecycle["delivery"] => {
    if (releases.state !== "ready") return sourceFailure(releases);
    if (!releaseRowsValid) return incompleteSource();
    if (extensions.state !== "ready") return sourceFailure(extensions);
    if (releases.rows.length === 0) {
      if (extensions.rows.length !== 0) return incompleteSource();
      return context.project.delivered_mail_at !== null || context.project.delivery_accepted_at !== null
        || context.project.status === "delivered" ? unsupported() : absentSource(context);
    }
    const release = releases.rows[0];
    let expiry = sourceTimestamp(release.expires_at);
    let previousRecordedAt = release.published_at;
    const seenOperations = new Set<string>();
    const orderedExtensions = [...extensions.rows].sort((a, b) => compareSourceTimes(a.new_expires_at, b.new_expires_at));
    for (const extension of orderedExtensions) {
      if (extension.release_id !== release.id || seenOperations.has(extension.operation_id)
        || !sourceOccurred(context, extension.created_at) || !notBefore(extension.created_at, previousRecordedAt)
        || !sameSourceTime(extension.previous_expires_at, expiry)
        || compareSourceTimes(extension.new_expires_at, expiry) <= 0
        || compareSourceTimes(extension.new_expires_at, extension.created_at) <= 0) return incompleteSource();
      seenOperations.add(extension.operation_id);
      expiry = sourceTimestamp(extension.new_expires_at);
      previousRecordedAt = extension.created_at;
    }
    const manifest = manifestSchema.safeParse(release.manifest_files);
    const finalFiles = files.state === "ready"
      ? files.rows.filter(file => file.folder === "final" && file.deleted_at === null) : [];
    const byId = new Map(finalFiles.map(file => [file.id, file]));
    const verified = fileRowsValid && manifest.success && release.manifest_shape_valid
      && release.manifest_bindings_valid && new Set(manifest.data.map(file => file.id)).size === manifest.data.length
      && finalFiles.length === manifest.data.length && manifest.data.every(item => {
      const file = byId.get(item.id);
      return file?.state === "ready" && file.content_type_valid && file.size_bytes === item.size_bytes
        && file.storage_version === item.storage_version && file.verified_at !== null
        && notBefore(release.published_at, file.verified_at);
    });
    // Publication remains a recorded fact when independent file verification
    // fails. "Unverified" blocks delivery commands without rolling progress back.
    return readySource(context, {
      ...sourceFact(context, release.id, sourceTimestamp(release.published_at), {
        releaseId: release.id, revision: release.revision, publishedAt: sourceTimestamp(release.published_at),
        originalExpiresAt: sourceTimestamp(release.expires_at), legacy: release.legacy,
        manifest: manifest.success ? manifest.data : null, manifestVerified: verified, extensions: orderedExtensions,
      }),
      kind: "release", manifest: verified ? "verified" : "unverified", expiresAt: expiry, expiryRevision: expiry,
      ...(release.case_work?{noticeRequired:true as const}:{}),
    });
  };

  const receipt = (): Lifecycle["receipt"] => {
    if (releases.state !== "ready") return sourceFailure(releases);
    if (!releaseRowsValid) return incompleteSource();
    const release = releases.rows[0];
    const acceptedAt = context.project.delivery_accepted_at;
    if (!release) return acceptedAt === null ? absentSource(context) : unsupported();
    if (release.accepted_at === null && acceptedAt === null) return absentSource(context);
    if (release.accepted_at === null || acceptedAt === null
      || !sameSourceTime(release.accepted_at, acceptedAt) || context.project.completed_at === null
      || !sameSourceTime(context.project.completed_at, acceptedAt)) return incompleteSource();
    return readySource(context, {
      ...sourceFact(context, release.id, sourceTimestamp(acceptedAt), { releaseId: release.id, acceptedAt: sourceTimestamp(acceptedAt) }),
      deliveryId: release.id, acceptedAt: sourceTimestamp(acceptedAt),
    });
  };

  const consultation = (): Lifecycle["consultation"] => {
    if (messages.state !== "ready") return sourceFailure(messages);
    if (messages.rows.some(message => !sourceOccurred(context, message.created_at))) return incompleteSource();
    // Latest sender is an activity rule, not an explicit unread/response-required record.
    return messages.rows.length === 0 ? absentSource(context) : unsupported();
  };

  return { production: production(), roughs: adaptRoughs(), delivery: delivery(), receipt: receipt(), consultation: consultation() };
}
