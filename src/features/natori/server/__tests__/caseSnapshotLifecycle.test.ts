import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { adaptCaseLifecycle } from "../caseSnapshotLifecycle";
import { deriveCaseReadModel } from "../../lib/caseReadModel";
import type { CaseSnapshot } from "../../types/caseReadModel";
import {
  CASE_SOURCE_LIMIT,
  absentSource,
  readySource,
  sourceFact,
  sourceProjectSchema,
  type CaseSourceContext,
  type CaseSourceProject,
} from "../caseSnapshotSource";

const PROJECT = "synthetic-project";
const OWNER = "synthetic-owner-private";
const OBSERVED = "2026-10-20T12:00:00.000Z";
const FUTURE = "2026-10-21T00:00:00.000Z";
const ROUGH_CREATED = "2026-10-03T00:00:00.000Z";
const ROUGH_OK = "2026-10-04T00:00:00.000Z";
const ACKNOWLEDGED = "2026-10-05T00:00:00.000Z";
const PUBLISHED = "2026-10-08T00:00:00.000Z";
const ACCEPTED = "2026-10-11T00:00:00.000Z";
const EXPIRES = "2026-11-01T00:00:00.000Z";
const EXTENDED = "2026-11-08T00:00:00.000Z";
const EXTENDED_AGAIN = "2026-11-15T00:00:00.000Z";
const incomplete = { state: "unavailable", reason: "incomplete" };
const unsupported = { state: "unavailable", reason: "unsupported" };
const absent = {
  state: "absent",
  snapshotId: "synthetic-snapshot",
  observedAt: OBSERVED,
  revision: "absent",
};

type Row = Record<string, unknown>;
const rows = (...values: readonly unknown[]) => ({ total: values.length, rows: values });

function context(
  sections: Readonly<Record<string, unknown>> = {},
  project: Partial<CaseSourceProject> = {},
): CaseSourceContext {
  return {
    project: sourceProjectSchema.parse({
      id: PROJECT,
      user_id: OWNER,
      status: "delivery_prep",
      type: "illustration",
      amount: null,
      active_quote_id: null,
      quote_accepted_at: null,
      quote_accepted_amount: null,
      payment_confirmed_at: null,
      paid_amount: null,
      paid_at: null,
      delivery_accepted_at: null,
      completed_at: null,
      delivered_mail_at: null,
      has_legacy_payment_link: false,
      payment_link_status: null,
      deleted_at: null,
      created_at: "2026-10-01T00:00:00.000Z",
      updated_at: "2026-10-12T00:00:00.000Z",
      ...project,
    }),
    snapshotId: "synthetic-snapshot",
    observedAt: OBSERVED,
    sections: {
      lifecycle_tasks: rows(),
      lifecycle_files: rows(),
      lifecycle_roughs: rows(),
      lifecycle_rough_acknowledgements: rows(),
      lifecycle_releases: rows(),
      lifecycle_extensions: rows(),
      lifecycle_consultation: rows(),
      ...sections,
    },
  };
}

const task = (patch: Row = {}) => ({
  id: "task-a", project_id: PROJECT, task_key: "final-check", stage: "delivery",
  done: true, sort_order: 1, ...patch,
});
const file = (patch: Row = {}) => ({
  id: "file-a", project_id: PROJECT, folder: "final", state: "ready",
  size_bytes: 1024, storage_version: "version-a",
  verified_at: "2026-10-07T00:00:00.000Z", deleted_at: null,
  created_at: "2026-10-06T00:00:00.000Z", content_type_valid: true, ...patch,
});
const rough = (patch: Row = {}) => ({
  id: "rough-a", project_id: PROJECT, message_id: "rough-message-a",
  before_quote: false, created_at: ROUGH_CREATED, client_ok_at: ROUGH_OK,
  message_bound: true, ...patch,
});
const acknowledgement = (patch: Row = {}) => ({
  id: "rough-a", project_id: PROJECT, owner_id: OWNER,
  client_ok_at: ROUGH_OK, acknowledged_at: ACKNOWLEDGED, ...patch,
});
const manifestFile = (patch: Row = {}) => ({
  id: "file-a", size_bytes: 1024, storage_version: "version-a", ...patch,
});
const release = (patch: Row = {}) => ({
  id: "release-a", project_id: PROJECT, revision: 1,
  published_at: PUBLISHED, expires_at: EXPIRES, accepted_at: null, legacy: false,
  manifest_files: [manifestFile()], manifest_shape_valid: true,
  manifest_bindings_valid: true, ...patch,
});
const extension = (patch: Row = {}) => ({
  id: "extension-a", project_id: PROJECT, release_id: "release-a",
  operation_id: "extension-operation-a", previous_expires_at: EXPIRES,
  new_expires_at: EXTENDED, created_at: "2026-10-09T00:00:00.000Z", ...patch,
});
const secondExtension = (patch: Row = {}) => extension({
  id: "extension-b", operation_id: "extension-operation-b",
  previous_expires_at: EXTENDED, new_expires_at: EXTENDED_AGAIN,
  created_at: "2026-10-10T00:00:00.000Z", ...patch,
});
const message = (patch: Row = {}) => ({
  id: "message-a", project_id: PROJECT, sender: "client",
  created_at: "2026-10-02T00:00:00.000Z", ...patch,
});

function released(
  sections: Readonly<Record<string, unknown>> = {},
  project: Partial<CaseSourceProject> = {},
): CaseSourceContext {
  return context({
    lifecycle_files: rows(file()),
    lifecycle_releases: rows(release()),
    ...sections,
  }, project);
}

function received(
  sections: Readonly<Record<string, unknown>> = {},
  project: Partial<CaseSourceProject> = {},
): CaseSourceContext {
  return released({
    lifecycle_releases: rows(release({ accepted_at: ACCEPTED })),
    ...sections,
  }, { status: "completed", delivery_accepted_at: ACCEPTED, completed_at: ACCEPTED, ...project });
}

const sourceCases = [
  { name: "lifecycle_tasks", row: task(), affected: ["production"] },
  { name: "lifecycle_files", row: file(), affected: ["production"] },
  { name: "lifecycle_roughs", row: rough(), affected: ["roughs"] },
  { name: "lifecycle_rough_acknowledgements", row: acknowledgement(), affected: ["roughs"] },
  { name: "lifecycle_releases", row: release(), affected: ["delivery", "receipt"] },
  { name: "lifecycle_extensions", row: extension(), affected: ["delivery"] },
  { name: "lifecycle_consultation", row: message(), affected: ["consultation"] },
] as const;

function populated(sectionName: string, section: unknown): CaseSourceContext {
  return released({
    lifecycle_tasks: rows(task()),
    lifecycle_roughs: rows(rough()),
    lifecycle_rough_acknowledgements: rows(acknowledgement()),
    lifecycle_extensions: rows(extension()),
    lifecycle_consultation: rows(message()),
    [sectionName]: section,
  });
}

describe("lifecycle source completeness", () => {
  it("distinguishes confirmed empty sections from sections that were not requested", () => {
    expect(adaptCaseLifecycle(context())).toEqual({
      production: absent, roughs: absent, delivery: absent, receipt: absent, consultation: absent,
    });
    const input = context();
    input.sections = {};
    expect(adaptCaseLifecycle(input)).toEqual({
      production: { state: "not_requested" },
      roughs: { state: "not_requested" },
      delivery: { state: "not_requested" },
      receipt: { state: "not_requested" },
      consultation: { state: "not_requested" },
    });
  });

  describe.each(sourceCases)("$name", ({ name, row, affected }) => {
    it("propagates an unrequested dependency without certifying absence", () => {
      const output = adaptCaseLifecycle(populated(name, undefined));
      for (const domain of affected) expect(output[domain]).toEqual({ state: "not_requested" });
    });

    it.each(["read_failed", "unsupported", "incomplete"] as const)("preserves %s", reason => {
      const output = adaptCaseLifecycle(populated(name, { state: "unavailable", reason }));
      for (const domain of affected) expect(output[domain]).toEqual({ state: "unavailable", reason });
    });

    it.each([
      ["partial count", (value: Row) => ({ total: 2, rows: [value] })],
      ["foreign project", (value: Row) => rows({ ...value, project_id: "another-project" })],
      ["duplicate identity", (value: Row) => rows(value, value)],
      ["truncated over-limit source", (value: Row) => ({ total: CASE_SOURCE_LIMIT + 1, rows: [value] })],
    ] as const)("rejects %s", (_label, section) => {
      const output = adaptCaseLifecycle(populated(name, section(row)));
      for (const domain of affected) expect(output[domain]).toEqual(incomplete);
    });
  });

  it("accepts a complete bounded rough set, but rejects a fully returned over-limit set", () => {
    const roughRows = Array.from({ length: CASE_SOURCE_LIMIT }, (_, index) =>
      rough({ id: `rough-${index}`, message_id: `rough-message-${index}`, client_ok_at: null }));
    const input = context({ lifecycle_roughs: rows(...roughRows) });
    const result = adaptCaseLifecycle(input).roughs;
    expect(result.state).toBe("ready");
    if (result.state === "ready") expect(result.value).toHaveLength(CASE_SOURCE_LIMIT);
    expect(adaptCaseLifecycle(context({
      lifecycle_roughs: rows(...roughRows, rough({ id: "rough-extra", message_id: "rough-message-extra" })),
    })).roughs).toEqual(incomplete);
  });
});

describe("production evidence boundaries", () => {
  it("does not invent recordedAt or work-start evidence from completed tasks", () => {
    expect(adaptCaseLifecycle(context({ lifecycle_tasks: rows(task()) })).production).toEqual(unsupported);
    expect(adaptCaseLifecycle(context({ lifecycle_tasks: rows(task({ done: false })) })).production).toEqual(unsupported);
  });

  it.each(["pending", "failed", "legacy_unverified", "deleting"] as const)(
    "never promotes a ready file mixed with a %s file into ready production", state => {
      expect(adaptCaseLifecycle(context({
        lifecycle_files: rows(file(), file({
          id: "file-unverified", state, storage_version: null, verified_at: null,
        })),
      })).production).toEqual(unsupported);
    },
  );

  it("rejects duplicate task keys even when task identities differ", () => {
    expect(adaptCaseLifecycle(context({
      lifecycle_tasks: rows(task(), task({ id: "task-b" })),
    })).production).toEqual(incomplete);
  });

  it.each([
    { created_at: FUTURE },
    { verified_at: FUTURE },
    { verified_at: "2026-10-05T00:00:00.000Z" },
    { deleted_at: FUTURE },
    { deleted_at: "2026-10-05T00:00:00.000Z" },
    { size_bytes: 0 },
    { content_type_valid: false },
    { storage_version: null },
    { verified_at: null },
  ])("rejects invalid ready-file evidence: %#", patch => {
    expect(adaptCaseLifecycle(context({ lifecycle_files: rows(file(patch)) })).production).toEqual(incomplete);
  });
});

describe("rough approval and staff acknowledgement", () => {
  it("preserves before-quote, approval and acknowledgement as separate facts in canonical order", () => {
    const result = adaptCaseLifecycle(context({
      lifecycle_roughs: rows(
        rough({ id: "rough-z", message_id: "message-z", before_quote: true, client_ok_at: null }),
        rough(),
      ),
      lifecycle_rough_acknowledgements: rows(acknowledgement({
        client_ok_at: "2026-10-04T09:00:00+09:00",
        acknowledged_at: "2026-10-05T09:00:00+09:00",
      })),
    })).roughs;
    expect(result).toMatchObject({
      state: "ready", snapshotId: "synthetic-snapshot", observedAt: OBSERVED,
      value: [
        { id: "rough-a", projectId: PROJECT, recordedAt: ROUGH_CREATED, source: "ledger",
          beforeQuote: false, clientOkAt: ROUGH_OK, acknowledgedAt: ACKNOWLEDGED },
        { id: "rough-z", beforeQuote: true, clientOkAt: null, acknowledgedAt: null },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(OWNER);
  });

  it("accepts a historical client OK without requiring an acknowledgement or notification event", () => {
    const result = adaptCaseLifecycle(context({ lifecycle_roughs: rows(rough()) })).roughs;
    expect(result).toMatchObject({
      state: "ready", value: [{ clientOkAt: ROUGH_OK, acknowledgedAt: null }],
    });
  });

  it("keeps the canonical client OK target revision stable when acknowledgement changes", () => {
    const before = adaptCaseLifecycle(context({
      lifecycle_roughs: rows(rough({ client_ok_at: "2026-10-04T09:00:00+09:00" })),
    })).roughs;
    const after = adaptCaseLifecycle(context({
      lifecycle_roughs: rows(rough()),
      lifecycle_rough_acknowledgements: rows(acknowledgement()),
    })).roughs;
    expect(before.state).toBe("ready");
    expect(after.state).toBe("ready");
    if (before.state !== "ready" || after.state !== "ready") return;
    expect(before.value[0].revision).toBe(ROUGH_OK);
    expect(after.value[0].revision).toBe(ROUGH_OK);
    expect(before.revision).not.toBe(after.revision);
  });

  it("rejects an acknowledgement bound to a different client OK within the same millisecond", () => {
    expect(adaptCaseLifecycle(context({
      lifecycle_roughs: rows(rough({ client_ok_at: "2026-10-04T00:00:00.123900Z" })),
      lifecycle_rough_acknowledgements: rows(acknowledgement({
        client_ok_at: "2026-10-04T00:00:00.123100Z",
      })),
    })).roughs).toEqual(incomplete);
  });

  it("preserves client OK microseconds in the target revision and accepts the same instant in another offset", () => {
    expect(adaptCaseLifecycle(context({
      lifecycle_roughs: rows(rough({ client_ok_at: "2026-10-04T00:00:00.123901Z" })),
      lifecycle_rough_acknowledgements: rows(acknowledgement({
        client_ok_at: "2026-10-04T09:00:00.123901+09:00",
      })),
    })).roughs).toMatchObject({
      state: "ready",
      value: [{ revision: "2026-10-04T00:00:00.123901Z", clientOkAt: "2026-10-04T00:00:00.123901Z" }],
    });
  });

  it("rejects an event later than observation even within the same millisecond", () => {
    const input = context({
      lifecycle_roughs: rows(rough({
        created_at: "2026-10-20T12:00:00.123900Z", client_ok_at: null,
      })),
    });
    input.observedAt = "2026-10-20T12:00:00.123100Z";
    expect(adaptCaseLifecycle(input).roughs).toEqual(incomplete);
  });

  it.each([
    { owner_id: "another-owner" },
    { project_id: "another-project" },
    { id: "another-rough" },
    { client_ok_at: "2026-10-04T00:00:01.000Z" },
    { acknowledged_at: FUTURE },
    { acknowledged_at: ROUGH_CREATED },
  ])("rejects an unbound or temporally invalid acknowledgement: %#", patch => {
    expect(adaptCaseLifecycle(context({
      lifecycle_roughs: rows(rough()),
      lifecycle_rough_acknowledgements: rows(acknowledgement(patch)),
    })).roughs).toEqual(incomplete);
  });

  it("requires client approval before staff acknowledgement", () => {
    expect(adaptCaseLifecycle(context({
      lifecycle_roughs: rows(rough({ client_ok_at: null })),
      lifecycle_rough_acknowledgements: rows(acknowledgement()),
    })).roughs).toEqual(incomplete);
  });

  it.each([
    { message_bound: false },
    { created_at: FUTURE },
    { client_ok_at: FUTURE },
    { client_ok_at: "2026-10-02T00:00:00.000Z" },
    { before_quote: "true" },
    { message_id: "" },
  ])("rejects invalid rough evidence: %#", patch => {
    expect(adaptCaseLifecycle(context({ lifecycle_roughs: rows(rough(patch)) })).roughs).toEqual(incomplete);
  });

  it("rejects multiple roughs bound to the same message", () => {
    expect(adaptCaseLifecycle(context({
      lifecycle_roughs: rows(rough(), rough({ id: "rough-b" })),
    })).roughs).toEqual(incomplete);
  });
});

describe("published delivery manifest", () => {
  it("certifies only the projected, verified immutable final set without implying notification or receipt", () => {
    const output = adaptCaseLifecycle(released());
    expect(output.delivery).toMatchObject({
      state: "ready", snapshotId: "synthetic-snapshot", observedAt: OBSERVED,
      value: { id: "release-a", projectId: PROJECT, recordedAt: PUBLISHED, source: "ledger",
        kind: "release", manifest: "verified", expiresAt: EXPIRES, expiryRevision: EXPIRES },
    });
    expect(output.receipt).toEqual(absent);
    expect(output).not.toHaveProperty("notifications");
  });

  it.each([
    { manifest_shape_valid: false },
    { manifest_bindings_valid: false },
    { manifest_files: null },
    { manifest_files: [] },
    { manifest_files: [manifestFile({ size_bytes: 0 })] },
    { manifest_files: [manifestFile({ size_bytes: 50_000_001 })] },
    { manifest_files: [manifestFile({ storage_version: "" })] },
    { manifest_files: [manifestFile(), manifestFile()] },
    { manifest_files: [manifestFile({ id: "other-file" })] },
    { manifest_files: [manifestFile({ size_bytes: 2048 })] },
    { manifest_files: [manifestFile({ storage_version: "other-version" })] },
  ])("preserves publication without verifying an unsafe or inconsistent manifest: %#", patch => {
    expect(adaptCaseLifecycle(released({ lifecycle_releases: rows(release(patch)) })).delivery).toMatchObject({
      state: "ready", value: { id: "release-a", manifest: "unverified", recordedAt: PUBLISHED },
    });
  });

  it.each([{ revision: 2 }, { published_at: FUTURE }])("rejects invalid release evidence: %#", patch => {
    expect(adaptCaseLifecycle(released({ lifecycle_releases: rows(release(patch)) })).delivery).toEqual(incomplete);
  });

  it.each([
    { state: "pending" },
    { state: "deleting" },
    { state: "legacy_unverified" },
    { state: "failed" },
    { folder: "rough" },
    { deleted_at: "2026-10-09T00:00:00.000Z" },
    { verified_at: "2026-10-09T00:00:00.000Z" },
    { content_type_valid: false },
  ])("retains publication as unverified when its file is not verified at publication: %#", patch => {
    expect(adaptCaseLifecycle(released({ lifecycle_files: rows(file(patch)) })).delivery).toMatchObject({
      state: "ready", value: { manifest: "unverified" },
    });
  });

  it("retains a publication with extra final files as unverified, but rejects multiple releases", () => {
    expect(adaptCaseLifecycle(released({
      lifecycle_files: rows(file(), file({ id: "file-extra" })),
    })).delivery).toMatchObject({ state: "ready", value: { manifest: "unverified" } });
    expect(adaptCaseLifecycle(released({
      lifecycle_releases: rows(release(), release({ id: "release-b" })),
    })).delivery).toEqual(incomplete);
  });

  it.each([
    undefined,
    { state: "unavailable", reason: "read_failed" },
    rows(),
    { total: 2, rows: [file()] },
    rows(file({ project_id: "another-project" })),
    rows(file(), file()),
    rows(file(), file({ id: "file-pending", state: "pending" })),
    rows(file(), file({ id: "file-legacy", state: "legacy_unverified" })),
  ])("preserves the release when independent file evidence cannot certify the manifest: %#", section => {
    expect(adaptCaseLifecycle(released({ lifecycle_files: section })).delivery).toMatchObject({
      state: "ready", value: { id: "release-a", manifest: "unverified", expiresAt: EXPIRES },
    });
  });

  it("retains delivery_issued in the read model and blocks extension until the manifest is verified", () => {
    const input = released({ lifecycle_files: { state: "unavailable", reason: "read_failed" } });
    const snapshot: CaseSnapshot = {
      projectId: PROJECT, snapshotId: input.snapshotId, asOf: OBSERVED,
      project: readySource(input, {
        ...sourceFact(input, PROJECT, input.project.updated_at, {}),
        rawStatus: "delivered", type: "illustration", archivedAt: null,
        origin: "internal", administrativeAmount: null,
      }),
      quote: absentSource(input),
      link: absentSource(input),
      payment: readySource(input, {
        ...sourceFact(input, "payment-a", ROUGH_OK, {}),
        confirmedAt: ROUGH_OK, money: { amount: 12000, currency: "JPY" }, method: "stripe",
      }),
      financialReview: readySource(input, []),
      notifications: readySource(input, []),
      operations: readySource(input, []),
      ...adaptCaseLifecycle(input),
      externalEvidence: { state: "unsupported" },
    };
    const model = deriveCaseReadModel(snapshot);
    expect(model.stage).toBe("delivery_issued");
    expect(model.facts.delivery).toMatchObject({ state: "ready", value: { manifest: "unverified" } });
    expect(model.actions.find(action => action.id === "extend_delivery")).toMatchObject({
      available: false, blockedBy: expect.arrayContaining(["legacy_evidence_required"]),
    });
  });

  it("does not put rough-folder or already deleted files into the immutable final set", () => {
    expect(adaptCaseLifecycle(released({
      lifecycle_files: rows(
        file(),
        file({ id: "rough-file", folder: "rough" }),
        file({ id: "deleted-file", deleted_at: "2026-10-09T00:00:00.000Z" }),
      ),
    })).delivery.state).toBe("ready");
  });

  it.each([
    { status: "delivered" as const },
    { delivered_mail_at: PUBLISHED },
    { delivery_accepted_at: ACCEPTED, completed_at: ACCEPTED },
  ])("keeps legacy delivery projections without a formal release unsupported: %#", project => {
    expect(adaptCaseLifecycle(context({}, project)).delivery).toEqual(unsupported);
  });
});

describe("delivery extension chain", () => {
  it("reconstructs the complete chain independent of row order and canonicalizes effective expiry", () => {
    const first = extension({
      previous_expires_at: "2026-11-01T09:00:00+09:00",
      new_expires_at: "2026-11-08T09:00:00+09:00",
    });
    const second = secondExtension({ new_expires_at: "2026-11-15T09:00:00+09:00" });
    const forward = adaptCaseLifecycle(released({ lifecycle_extensions: rows(first, second) })).delivery;
    const reversed = adaptCaseLifecycle(released({ lifecycle_extensions: rows(second, first) })).delivery;
    expect(forward).toEqual(reversed);
    expect(forward).toMatchObject({
      state: "ready", value: { expiresAt: EXTENDED_AGAIN, expiryRevision: EXTENDED_AGAIN },
    });
  });

  it("rejects an extension predecessor that differs from current expiry within the same millisecond", () => {
    expect(adaptCaseLifecycle(released({
      lifecycle_releases: rows(release({ expires_at: "2026-11-01T00:00:00.123900Z" })),
      lifecycle_extensions: rows(extension({ previous_expires_at: "2026-11-01T00:00:00.123100Z" })),
    })).delivery).toEqual(incomplete);
  });

  it.each([
    ["2026-11-01T00:00:00.123901Z", "2026-11-08T00:00:00.456789Z"],
    ["2026-11-01T09:00:00.123901+09:00", "2026-11-08T09:00:00.456789+09:00"],
  ])("preserves exact expiry microseconds across an equivalent predecessor: %s", (previous, next) => {
    expect(adaptCaseLifecycle(released({
      lifecycle_releases: rows(release({ expires_at: "2026-11-01T00:00:00.123901Z" })),
      lifecycle_extensions: rows(extension({ previous_expires_at: previous, new_expires_at: next })),
    })).delivery).toMatchObject({
      state: "ready",
      value: {
        expiresAt: "2026-11-08T00:00:00.456789Z",
        expiryRevision: "2026-11-08T00:00:00.456789Z",
      },
    });
  });

  it("preserves original expiry microseconds even without extensions", () => {
    expect(adaptCaseLifecycle(released({
      lifecycle_releases: rows(release({ expires_at: "2026-11-01T09:00:00.123901+09:00" })),
    })).delivery).toMatchObject({
      state: "ready",
      value: {
        expiresAt: "2026-11-01T00:00:00.123901Z",
        expiryRevision: "2026-11-01T00:00:00.123901Z",
      },
    });
  });

  it.each([
    { release_id: "another-release" },
    { previous_expires_at: "2026-11-02T00:00:00.000Z" },
    { new_expires_at: EXPIRES },
    { new_expires_at: "2026-10-31T00:00:00.000Z" },
    { created_at: FUTURE },
    { created_at: "2026-10-07T00:00:00.000Z" },
  ])("rejects an unbound, broken or impossible extension: %#", patch => {
    expect(adaptCaseLifecycle(released({
      lifecycle_extensions: rows(extension(patch)),
    })).delivery).toEqual(incomplete);
  });

  it("rejects a new deadline already expired when extension was recorded", () => {
    expect(adaptCaseLifecycle(released({
      lifecycle_releases: rows(release({ expires_at: "2026-10-08T12:00:00.000Z" })),
      lifecycle_extensions: rows(extension({
        previous_expires_at: "2026-10-08T12:00:00.000Z",
        new_expires_at: "2026-10-09T00:00:00.000Z",
        created_at: "2026-10-09T00:00:00.000Z",
      })),
    })).delivery).toEqual(incomplete);
  });

  it("rejects missing predecessors, duplicate operations and reversed recording times", () => {
    for (const extensions of [
      [secondExtension()],
      [extension(), secondExtension({ operation_id: "extension-operation-a" })],
      [extension(), secondExtension({ created_at: PUBLISHED })],
    ]) {
      expect(adaptCaseLifecycle(released({ lifecycle_extensions: rows(...extensions) })).delivery).toEqual(incomplete);
    }
  });

  it("does not silently discard an extension without its release", () => {
    expect(adaptCaseLifecycle(context({
      lifecycle_extensions: rows(extension()),
    })).delivery).toEqual(incomplete);
  });
});

describe("receipt as independent confirmed evidence", () => {
  it("requires release acceptance, project acceptance and completion to identify the same instant", () => {
    expect(adaptCaseLifecycle(received({}, {
      delivery_accepted_at: "2026-10-11T09:00:00+09:00",
      completed_at: "2026-10-11T09:00:00+09:00",
    })).receipt).toMatchObject({
      state: "ready",
      value: { id: "release-a", deliveryId: "release-a", projectId: PROJECT,
        recordedAt: ACCEPTED, acceptedAt: ACCEPTED, source: "ledger" },
    });
  });

  it("rejects release and project receipt stamps that differ within the same millisecond", () => {
    expect(adaptCaseLifecycle(received({
      lifecycle_releases: rows(release({ accepted_at: "2026-10-11T00:00:00.123100Z" })),
    }, {
      delivery_accepted_at: "2026-10-11T00:00:00.123900Z",
      completed_at: "2026-10-11T00:00:00.123900Z",
    })).receipt).toEqual(incomplete);
  });

  it("keeps receipt microseconds when all three stamps identify the same instant across offsets", () => {
    expect(adaptCaseLifecycle(received({
      lifecycle_releases: rows(release({ accepted_at: "2026-10-11T00:00:00.123901Z" })),
    }, {
      delivery_accepted_at: "2026-10-11T09:00:00.123901+09:00",
      completed_at: "2026-10-11T00:00:00.123901Z",
    })).receipt).toMatchObject({
      state: "ready",
      value: {
        recordedAt: "2026-10-11T00:00:00.123901Z",
        acceptedAt: "2026-10-11T00:00:00.123901Z",
      },
    });
  });

  it.each([
    { delivery_accepted_at: null },
    { completed_at: null },
    { delivery_accepted_at: "2026-10-11T00:00:01.000Z" },
    { completed_at: "2026-10-11T00:00:01.000Z" },
  ])("rejects incomplete or contradictory project receipt evidence: %#", project => {
    expect(adaptCaseLifecycle(received({}, project)).receipt).toEqual(incomplete);
  });

  it("does not synthesize a release receipt from a project stamp or completion status", () => {
    expect(adaptCaseLifecycle(received({ lifecycle_releases: rows() })).receipt).toEqual(unsupported);
    expect(adaptCaseLifecycle(context({}, { status: "completed", completed_at: ACCEPTED })).receipt).toEqual(absent);
    expect(adaptCaseLifecycle(received({
      lifecycle_releases: rows(release({ accepted_at: null })),
    })).receipt).toEqual(incomplete);
  });

  it("permits earlier acceptance only for a legacy-adopted release", () => {
    const earlier = "2026-10-07T00:00:00.000Z";
    const project = { delivery_accepted_at: earlier, completed_at: earlier };
    expect(adaptCaseLifecycle(received({
      lifecycle_releases: rows(release({ accepted_at: earlier, legacy: true })),
    }, project)).receipt).toMatchObject({ state: "ready", value: { acceptedAt: earlier } });
    expect(adaptCaseLifecycle(received({
      lifecycle_releases: rows(release({ accepted_at: earlier, legacy: false })),
    }, project)).receipt).toEqual(incomplete);
  });

  it("rejects future acceptance even when all receipt stamps agree", () => {
    expect(adaptCaseLifecycle(received({
      lifecycle_releases: rows(release({ accepted_at: FUTURE })),
    }, { delivery_accepted_at: FUTURE, completed_at: FUTURE })).receipt).toEqual(incomplete);
  });

  it.each([
    { lifecycle_releases: rows(release({
      accepted_at: ACCEPTED, manifest_files: null, manifest_shape_valid: false,
    })) },
    { lifecycle_releases: rows(release({ accepted_at: ACCEPTED, manifest_bindings_valid: false })) },
    { lifecycle_files: { state: "unavailable", reason: "read_failed" } },
    { lifecycle_files: rows(file({ state: "deleting" })) },
    { lifecycle_extensions: { state: "unavailable", reason: "read_failed" } },
    { lifecycle_extensions: rows(secondExtension()) },
  ])("preserves matching receipt evidence when delivery verification independently fails: %#", sections => {
    const output = adaptCaseLifecycle(received(sections));
    expect(output.delivery).not.toMatchObject({ state: "ready", value: { manifest: "verified" } });
    expect(output.receipt).toMatchObject({
      state: "ready", value: { deliveryId: "release-a", acceptedAt: ACCEPTED },
    });
  });
});

describe("consultation evidence and safe deterministic output", () => {
  it.each(["client", "staff"] as const)("never infers response required from %s sender or message text", sender => {
    expect(adaptCaseLifecycle(context({
      lifecycle_consultation: rows(message({
        sender, body: "Please reply now. APPROVED. Payment received.", response_required: true,
      })),
    })).consultation).toEqual(unsupported);
  });

  it("rejects future consultation activity", () => {
    expect(adaptCaseLifecycle(context({
      lifecycle_consultation: rows(message({ created_at: FUTURE })),
    })).consultation).toEqual(incomplete);
  });

  it("drops unrelated private fields including unknown manifest fields without changing facts or revisions", () => {
    const base = received({
      lifecycle_roughs: rows(rough()),
      lifecycle_rough_acknowledgements: rows(acknowledgement()),
    });
    const secret = "synthetic-private-value-never-return";
    const extra = {
      token: secret, email: secret, storage_path: secret, file_name: secret,
      body: secret, note: secret, signed_url: secret,
    };
    const injected = received({
      lifecycle_files: rows(file(extra)),
      lifecycle_roughs: rows(rough(extra)),
      lifecycle_rough_acknowledgements: rows(acknowledgement(extra)),
      lifecycle_releases: rows(release({
        accepted_at: ACCEPTED, ...extra,
        manifest_files: [manifestFile({ ...extra, path: secret, fileName: secret, contentType: secret })],
      })),
    });
    const output = adaptCaseLifecycle(injected);
    expect(output).toEqual(adaptCaseLifecycle(base));
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(JSON.stringify(output)).not.toContain(OWNER);
  });

  it("is reproducible, ignores the ambient clock and does not mutate frozen input", () => {
    const input = received({
      lifecycle_roughs: rows(
        rough({ id: "rough-z", message_id: "message-z" }),
        rough(),
      ),
      lifecycle_rough_acknowledgements: rows(acknowledgement()),
      lifecycle_extensions: rows(secondExtension(), extension()),
    });
    function freeze(value: unknown): void {
      if (value !== null && typeof value === "object") {
        Object.freeze(value);
        for (const child of Object.values(value)) freeze(child);
      }
    }
    const before = JSON.stringify(input);
    freeze(input);
    const first = adaptCaseLifecycle(input);
    const clock = vi.spyOn(Date, "now").mockImplementation(() => {
      throw new Error("The lifecycle adapter must use observedAt, not the clock.");
    });
    try {
      expect(adaptCaseLifecycle(input)).toEqual(first);
      expect(JSON.stringify(input)).toBe(before);
    } finally {
      clock.mockRestore();
    }
  });
});
