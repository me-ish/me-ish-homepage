import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ operator: vi.fn(), owner: vi.fn() }));
vi.mock("../requireNatoriAdmin", () => ({ resolveNatoriOperator: auth.operator }));
vi.mock("../trustedNatoriOwner", () => ({ resolveTrustedNatoriOwnerId: auth.owner }));
import { readCaseManagement } from "../caseManagementReader";
import { CASE_MANAGEMENT_SECTIONS, CASE_MANAGEMENT_SQL } from "../caseManagementQuery";
import { natoriManagementScope } from "../natoriManagementScope";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const OPERATOR = "33333333-3333-4333-8333-333333333333";
const TIME = "2026-10-20T00:00:00Z";
const BEFORE = "2026-10-19T00:00:00Z";
function envelope() {
  return {
    snapshot_id: "synthetic-snapshot", observed_at: TIME,
    project: {
      id: PROJECT, user_id: OWNER, status: "inquiry", type: "undecided", amount: null,
      active_quote_id: null, quote_accepted_at: null, quote_accepted_amount: null,
      payment_confirmed_at: null, paid_amount: null, paid_at: null,
      delivery_accepted_at: null, completed_at: null, delivered_mail_at: null,
      has_legacy_payment_link: false, payment_link_status: null, deleted_at: null,
      created_at: BEFORE, updated_at: BEFORE,
    },
    sections: Object.fromEntries(CASE_MANAGEMENT_SECTIONS.map(name => [name, { total: 0, rows: [] }])) as Record<string, unknown>,
  };
}

function acceptedLinkEnvelope() {
  const row = envelope();
  const accepted = "2026-10-19T01:00:00Z";
  const linkCreated = "2026-10-19T02:00:00Z";
  const deadline = "2026-10-27T00:00:00Z";
  Object.assign(row.project, {
    status: "awaiting_payment", type: "icon", amount: 40000, active_quote_id: "quote",
    quote_accepted_at: accepted, quote_accepted_amount: 40000,
    has_legacy_payment_link: true, payment_link_status: "active", updated_at: linkCreated,
  });
  row.sections.project_intake = { total: 1, rows: [{
    id: "intake", project_id: PROJECT, status: "completed", created_at: BEFORE, updated_at: BEFORE,
  }] };
  row.sections.financial_quotes = { total: 1, rows: [{
    id: "quote", project_id: PROJECT, user_id: OWNER, version: 1, amount: 40000,
    expires_at: deadline, accepted_at: accepted, superseded_at: null, created_at: BEFORE, issued_at: BEFORE,
  }] };
  row.sections.financial_links = { total: 1, rows: [{
    id: "link", project_id: PROJECT, owner_id: OWNER, quote_id: "quote", generation: 1, amount: 40000,
    state: "active", deadline, deadline_revision: 2, created_at: linkCreated, updated_at: linkCreated,
    has_provider_link: true, is_project_link: true,
  }] };
  const notice = {
    id: "notice", project_id: PROJECT, quote_id: "quote", notification_key: "opaque-notice-series",
    attempt_no: 1, purpose: "payment_link_client", status: "sent", sent_at: linkCreated,
    created_at: linkCreated, updated_at: linkCreated,
    snapshot: { attemptId: "link", generation: 1, deadline: "2026-10-25T00:00:00Z" },
    payload_expires_at: null, release_id: null, release_expires_at: null, release_accepted_at: null,
    message_id: null, message_created_at: null, message_sender: null, message_operation_id: null,
    rough_id: null, rough_ok_at: null,
  };
  row.sections.financial_notifications = { total: 1, rows: [notice] };
  return { row, notice };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.operator.mockResolvedValue({ kind: "auth-user", userId: OPERATOR });
  auth.owner.mockReturnValue({ kind: "ok", ownerId: OWNER });
});

describe("authorized case management reader", () => {
  it("authorizes before executing one statement and binds the management owner, not operator", async () => {
    const execute = vi.fn(async () => {
      expect(auth.operator).toHaveBeenCalledOnce();
      expect(auth.owner).toHaveBeenCalledOnce();
      return { rows: [envelope()] };
    });
    const result = await readCaseManagement(PROJECT, execute);
    expect(execute).toHaveBeenCalledExactlyOnceWith({ text: CASE_MANAGEMENT_SQL, values: [PROJECT, OWNER] });
    expect(result.state).toBe("ready");
    if (result.state === "ready") {
      expect(result.model.eligibility).toBe("active");
      expect(result.model.facts.project).toMatchObject({ state: "ready", value: { origin: "unknown" } });
      expect(result.model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
    }
  });

  it("reads no data and resolves no owner for unauthorized requests", async () => {
    auth.operator.mockResolvedValue(null);
    const execute = vi.fn();
    expect(await readCaseManagement(PROJECT, execute)).toEqual({ state: "unavailable", reason: "unauthorized" });
    expect(execute).not.toHaveBeenCalled();
    expect(auth.owner).not.toHaveBeenCalled();
  });

  it.each(["unconfigured", "invalid"])("fails closed for %s owner configuration", async kind => {
    auth.owner.mockReturnValue({ kind });
    const execute = vi.fn();
    expect(await readCaseManagement(PROJECT, execute)).toEqual({ state: "unavailable", reason: "owner_unavailable" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("uses the existing request-local management scope", async () => {
    const execute = vi.fn(async () => ({ rows: [envelope()] }));
    await natoriManagementScope.run({ ownerId: OWNER, operator: { kind: "shared-key", userId: null } },
      () => readCaseManagement(PROJECT, execute));
    expect(execute).toHaveBeenCalledExactlyOnceWith({ text: CASE_MANAGEMENT_SQL, values: [PROJECT, OWNER] });
    expect(auth.operator).not.toHaveBeenCalled();
    expect(natoriManagementScope.getStore()).toBeUndefined();
  });

  it.each(["", "' OR true --", "not-a-uuid"])("rejects invalid project %s before transport", async id => {
    const execute = vi.fn();
    expect(await readCaseManagement(id, execute)).toEqual({ state: "unavailable", reason: "invalid_request" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects an invalid scoped owner before transport", async () => {
    const execute = vi.fn();
    expect(await natoriManagementScope.run({ ownerId: "bad-owner", operator: { kind: "shared-key", userId: null } },
      () => readCaseManagement(PROJECT, execute))).toEqual({ state: "unavailable", reason: "owner_unavailable" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not expose provider error details or turn failure into absence", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("postgres password=secret email=private@example.test"));
    expect(await readCaseManagement(PROJECT, execute)).toEqual({ state: "unavailable", reason: "read_failed" });
  });

  it("returns the same empty result for a missing project or wrong-owner SQL result", async () => {
    expect(await readCaseManagement(PROJECT, async () => ({ rows: [] }))).toEqual({ state: "not_found" });
  });

  it.each(["id", "user_id"])("rejects a returned %s mismatch without exposing related rows", async field => {
    const row = envelope();
    row.project[field as "id" | "user_id"] = OPERATOR;
    row.sections.private = { secret: "do-not-return" };
    expect(await readCaseManagement(PROJECT, async () => ({ rows: [row] })))
      .toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("rejects multiple root projects", async () => {
    expect(await readCaseManagement(PROJECT, async () => ({ rows: [envelope(), envelope()] })))
      .toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("rejects a missing requested relation instead of claiming it was deliberately unrequested", async () => {
    const row = envelope();
    delete row.sections.project_intake;
    expect(await readCaseManagement(PROJECT, async () => ({ rows: [row] })))
      .toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it.each(["created_at", "updated_at", "paid_at", "completed_at"])("rejects future project %s", async field => {
    const row = envelope();
    Object.assign(row.project, { [field]: "2026-10-21T00:00:00Z" });
    expect(await readCaseManagement(PROJECT, async () => ({ rows: [row] })))
      .toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it.each(["2026-02-30T00:00:00Z", "2026-10-20", "not-a-time"])("rejects invalid observedAt %s", async time => {
    const row = envelope();
    row.observed_at = time;
    expect(await readCaseManagement(PROJECT, async () => ({ rows: [row] })))
      .toEqual({ state: "unavailable", reason: "incomplete" });
  });

  it("recognizes explicit completed intake without retaining owner or extra sensitive fields", async () => {
    const row = envelope();
    row.sections.project_intake = { total: 1, rows: [{
      id: "intake-operation", project_id: PROJECT, status: "completed", created_at: BEFORE, updated_at: BEFORE,
      owner_id: OWNER, payload: "secret-body", email: "private@example.test",
    }] };
    Object.assign(row.project, { client_name: "PRIVATE-NAME", client_email: "private@example.test",
      stripe_payment_session_id: "cs_secret", delivery_token_hash: "PRIVATE-TOKEN" });
    const result = await readCaseManagement(PROJECT, async () => ({ rows: [row] }));
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;
    expect(result.model.facts.project).toMatchObject({ state: "ready", value: { origin: "internal", id: PROJECT } });
    expect(result.metadata.clientLabel).toBe("PRIVATE-NAME");
    expect(JSON.stringify(result.model)).not.toContain("PRIVATE-NAME");
    for (const secret of [OWNER, OPERATOR, "secret-body", "private@example.test", "cs_secret", "PRIVATE-TOKEN"]) {
      expect(JSON.stringify(result)).not.toContain(secret);
    }
  });

  it.each(["processing", "failed", "needs_review"])("does not infer an origin from intake status %s", async status => {
    const row = envelope();
    row.sections.project_intake = { total: 1, rows: [{
      id: "intake-operation", project_id: PROJECT, status, created_at: BEFORE, updated_at: BEFORE,
    }] };
    const result = await readCaseManagement(PROJECT, async () => ({ rows: [row] }));
    expect(result.state).toBe("ready");
    if (result.state === "ready") expect(result.model.facts.project).toEqual({ state: "unavailable", reason: "unsupported" });
  });

  it("treats count/row disagreement as incomplete and blocks preparation", async () => {
    const row = envelope();
    row.sections.project_intake = { total: 1, rows: [] };
    const result = await readCaseManagement(PROJECT, async () => ({ rows: [row] }));
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;
    expect(result.model.facts.project).toEqual({ state: "unavailable", reason: "incomplete" });
    expect(result.model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
  });
});

describe("fixed read statement safety contract", () => {
  it("uses an owner-scoped root and parameter values, no write/RPC/locking statements", () => {
    expect(CASE_MANAGEMENT_SQL).toMatch(/WHERE p\.id = \$1::uuid AND p\.user_id = \$2::uuid/);
    expect(CASE_MANAGEMENT_SQL).not.toMatch(/\b(INSERT|UPDATE|DELETE|MERGE|CALL|FOR SHARE|FOR UPDATE)\b/i);
    expect(CASE_MANAGEMENT_SQL).not.toMatch(/clock_timestamp|gen_random_uuid|dblink|http_|;|--/i);
    expect(CASE_MANAGEMENT_SQL).toContain("pg_current_snapshot()");
    expect(CASE_MANAGEMENT_SQL).toContain("statement_timestamp()");
    expect(CASE_MANAGEMENT_SQL).not.toContain(PROJECT);
  });

  it("counts complete relation sets and bounds their returned rows in the same statement", () => {
    for (const name of CASE_MANAGEMENT_SECTIONS) {
      expect(CASE_MANAGEMENT_SQL).toContain(`count(*) FROM ${name}_rows`);
      expect(CASE_MANAGEMENT_SQL).toContain(`FROM ${name}_rows ORDER BY id LIMIT 201`);
    }
  });
});

describe("source envelope through the common model", () => {
  it("correlates the current link deadline without promoting an old successful notice", async () => {
    const { row, notice } = acceptedLinkEnvelope();
    const result = await readCaseManagement(PROJECT, async () => ({ rows: [row] }));
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;
    expect(result.model.stage).toBe("payment_available");
    expect(result.model.notifications.find(summary => summary.target.kind === "payment_link")).toMatchObject({
      target: { id: "link", revision: "2026-10-27T00:00:00.000Z" },
      pastSuccessIds: ["notice"], currentSuccessIds: [],
    });
    notice.snapshot.deadline = "2026-10-27T09:00:00+09:00";
    const sameConditions = await readCaseManagement(PROJECT, async () => ({ rows: [row] }));
    expect(sameConditions.state).toBe("ready");
    if (sameConditions.state === "ready") {
      expect(sameConditions.model.notifications.find(summary => summary.target.kind === "payment_link")?.currentSuccessIds)
        .toEqual(["notice"]);
    }
  });

  it("keeps a recorded payment when financial review cannot be read and blocks preparation", async () => {
    const { row } = acceptedLinkEnvelope();
    Object.assign(row.project, { payment_confirmed_at: BEFORE, paid_at: BEFORE, paid_amount: null });
    row.sections.financial_inbox = { state: "unavailable", reason: "read_failed" };
    const result = await readCaseManagement(PROJECT, async () => ({ rows: [row] }));
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;
    expect(result.model.stage).toBe("paid");
    expect(result.model.facts.payment).toMatchObject({ state: "ready", value: {
      confirmedAt: BEFORE, money: null, source: "legacy_projection",
    } });
    expect(result.model.facts.financialReview).toEqual({ state: "unavailable", reason: "read_failed" });
    expect(result.model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
  });

  it("keeps an explicit receipt even when extension and manifest evidence is incomplete", async () => {
    const row = envelope();
    Object.assign(row.project, {
      status: "completed", delivery_accepted_at: BEFORE, completed_at: BEFORE,
    });
    row.sections.lifecycle_releases = { total: 1, rows: [{
      id: "release", project_id: PROJECT, revision: 1, published_at: BEFORE,
      expires_at: "2026-10-25T00:00:00Z", accepted_at: BEFORE, legacy: false,
      manifest_files: null, manifest_shape_valid: false, manifest_bindings_valid: false,
    }] };
    row.sections.lifecycle_extensions = { total: 1, rows: [] };
    const result = await readCaseManagement(PROJECT, async () => ({ rows: [row] }));
    expect(result.state).toBe("ready");
    if (result.state !== "ready") return;
    expect(result.model.stage).toBe("received");
    expect(result.model.facts.receipt).toMatchObject({ state: "ready", value: {
      deliveryId: "release", acceptedAt: "2026-10-19T00:00:00.000Z",
    } });
    expect(result.model.facts.delivery).toEqual({ state: "unavailable", reason: "incomplete" });
    expect(result.model.actions.filter(action => action.execution !== "read_only").every(action => !action.available)).toBe(true);
  });
});

it("returns a bounded opaque display fingerprint without changing state or substituting a write revision",async()=>{
 const first=envelope(),read=async(row:ReturnType<typeof envelope>)=>readCaseManagement(PROJECT,async()=>({rows:[row]}));
 const a=await read(first),b=await read(envelope());expect(a.state).toBe("ready");expect(b.state).toBe("ready");
 if(a.state!=="ready"||b.state!=="ready")throw Error("fixture");
 expect(a.model.fingerprint).toMatch(/^case-sha256:[a-f0-9]{64}$/);expect(a.model.fingerprint).toBe(b.model.fingerprint);
 const changed=envelope();changed.observed_at="2026-10-20T00:01:00Z";const c=await read(changed);
 if(c.state!=="ready")throw Error("fixture");expect(c.model.fingerprint).not.toBe(a.model.fingerprint);
 expect(c.model.stage).toBe(a.model.stage);expect(b.model.facts).toEqual(a.model.facts);
});
