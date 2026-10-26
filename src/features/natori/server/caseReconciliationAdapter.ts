import "server-only";
import { z } from "zod";
import type {
  ReconciliationFacts,
  ReconciliationIdentity,
  ReconciliationKind,
} from "../lib/caseReconciliation";
export type ReconciliationProvider = {
  inspect(
    kind: ReconciliationKind,
    identity: ReconciliationIdentity,
    signal?: AbortSignal,
  ): Promise<ReconciliationFacts>;
  stopOldLink(
    identity: ReconciliationIdentity,
    signal?: AbortSignal,
  ): Promise<ReconciliationFacts>;
};
type Context = {
  scope?: string;
  account: string;
  active: boolean;
  target?: { run: string };
};
type Dependencies = {
  fetch: typeof fetch;
  context: (
    owner: string,
    project: string,
    mutation: boolean,
  ) => Promise<Context | null>;
  key: () => string;
  mail: (i: ReconciliationIdentity, signal?: AbortSignal) => Promise<unknown>;
  now?: () => number;
  beforeMutation?: () => Promise<void>;
};
const metadata = z.record(z.string(), z.string());
const price = z.object({
  id: z.string().regex(/^price_[A-Za-z0-9]+$/),
  unit_amount: z.number().int(),
  currency: z.string(),
  livemode: z.boolean(),
  metadata,
});
const link = z.object({
  id: z.string().regex(/^plink_[A-Za-z0-9]+$/),
  url: z.string(),
  active: z.boolean(),
  livemode: z.boolean(),
  metadata,
});
const session = z.object({
  id: z.string().regex(/^cs_[A-Za-z0-9_]+$/),
  status: z.enum(["open", "complete", "expired"]),
  payment_status: z.string(),
  livemode: z.boolean(),
  metadata,
  amount_total: z.number().int().nullable(),
  currency: z.string().nullable(),
  payment_link: z.string().nullable(),
  payment_intent: z.string().nullable(),
});
class EvidenceLimit extends Error {
  constructor(readonly limit: ReconciliationFacts["limits"][number]) {
    super(limit);
  }
}
/** Acceptance remains permanently test-only; production has a separate explicit factory. */
export function createAcceptanceReconciliationProvider(d: Dependencies): ReconciliationProvider {
  return createScopedReconciliationProvider(d, false, "acceptance");
}
export function createProductionReconciliationProvider(d: Dependencies): ReconciliationProvider {
  return createScopedReconciliationProvider(d, true, "production");
}
function createScopedReconciliationProvider(
  d: Dependencies, live: boolean, profile: "acceptance" | "production",
): ReconciliationProvider {
  const now = () => new Date(d.now?.() ?? Date.now()).toISOString();
  const base = (i: ReconciliationIdentity): ReconciliationFacts => ({
    state: "unknown",
    source: "provider_retrieval",
    identity: i,
    checkedAt: now(),
    complete: false,
    limits: [],
  });
  async function context(
    i: ReconciliationIdentity,
    mutation: boolean,
    signal?: AbortSignal,
  ) {
    signal?.throwIfAborted();
    const c = await d.context(i.owner, i.project, mutation);
    signal?.throwIfAborted();
    if (
      !c ||
      (mutation && !c.active) ||
      i.account !== c.account ||
      i.livemode !== live ||
      i.purpose !== "natori_commission" ||
      i.scope !== "platform"
    )
      throw new EvidenceLimit("identity_mismatch");
    const key = d.key();
    if (!(live ? /^(sk|rk)_live_[A-Za-z0-9_]+$/ : /^(sk|rk)_test_[A-Za-z0-9_]+$/).test(key))
      throw new EvidenceLimit("scope_missing");
    return { c, key };
  }
  async function request(
    i: ReconciliationIdentity,
    path: string,
    signal?: AbortSignal,
    body?: Record<string, string>,
  ) {
    const bound = await context(i, !!body, signal);
    // Verify the credential's account on every request, then reject a key/config
    // change across awaits. No cached account proof leaks between parallel jobs.
    const accountResponse = await d.fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${bound.key}` }, signal,
      cache: "no-store", redirect: "error",
    });
    const account = z.object({ id: z.string() }).parse(await accountResponse.json());
    if (!accountResponse.ok || account.id !== bound.c.account) throw new EvidenceLimit("identity_mismatch");
    if (body) {
      if (!d.beforeMutation) throw new EvidenceLimit("scope_missing");
      await d.beforeMutation();
    }
    const fresh = await context(i, !!body, signal);
    if (fresh.key !== bound.key || fresh.c.account !== bound.c.account
      || fresh.c.scope !== bound.c.scope || fresh.c.target?.run !== bound.c.target?.run) throw new EvidenceLimit("scope_missing");
    signal?.throwIfAborted();
    const r = await d.fetch("https://api.stripe.com/v1/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${bound.key}`,
        ...(body
          ? {
              "Content-Type": "application/x-www-form-urlencoded",
              "Idempotency-Key": `natori-${profile === "acceptance" ? "r3" : "case"}-stop/${i.target}/${path}`,
            }
          : {}),
      },
      ...(body ? { body: new URLSearchParams(body) } : {}),
      signal,
      cache: "no-store",
      redirect: "error",
    });
    if (r.status === 404) throw new EvidenceLimit("not_found");
    if (!r.ok) throw new EvidenceLimit("provider_unavailable");
    return r.json();
  }
  async function list(
    i: ReconciliationIdentity,
    path: string,
    signal?: AbortSignal,
  ): Promise<unknown[]> {
    let after: string | undefined;
    const all: unknown[] = [];
    for (let page = 0; page < 10; page++) {
      const value = z
        .object({ data: z.array(z.unknown()), has_more: z.boolean() })
        .parse(
          await request(
            i,
            path +
              (path.includes("?") ? "&" : "?") +
              new URLSearchParams({
                limit: "100",
                ...(after ? { starting_after: after } : {}),
              }),
            signal,
          ),
        );
      all.push(...value.data);
      if (!value.has_more) return all;
      const last = z.object({ id: z.string() }).parse(value.data.at(-1)).id;
      if (!last || last === after) break;
      after = last;
    }
    throw new EvidenceLimit("pagination");
  }
  const matches = (m: Record<string, string>, i: ReconciliationIdentity) =>
    m.kind === i.purpose &&
    m.projectId === i.project &&
    m.quoteId === i.quote &&
    m.attemptId === i.attempt &&
    m.generation === String(i.generation);
  async function readLink(i: ReconciliationIdentity, signal?: AbortSignal) {
    let id = i.link;
    if (!id) {
      const candidates = (await list(i, "payment_links", signal))
        .map((v) => link.parse(v))
        .filter((v) => v.metadata.attemptId === i.attempt);
      if (candidates.length !== 1)
        throw new EvidenceLimit(candidates.length ? "multiple" : "not_found");
      id = candidates[0].id;
    }
    const value = link.parse(
      await request(i, "payment_links/" + encodeURIComponent(id), signal),
    );
    const items = z
      .object({
        data: z.array(z.object({ quantity: z.number(), price })).length(1),
        has_more: z.literal(false),
      })
      .parse(
        await request(
          i,
          "payment_links/" + encodeURIComponent(id) + "/line_items?limit=2",
          signal,
        ),
      );
    const p = items.data[0].price;
    if (
      value.id !== id ||
      value.livemode !== live ||
      !matches(value.metadata, i) ||
      items.data[0].quantity !== 1 ||
      p.livemode !== live ||
      p.unit_amount !== i.amount ||
      p.currency !== i.currency ||
      !matches(p.metadata, i) ||
      (i.price && p.id !== i.price) ||
      !/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/.test(value.url)
    )
      throw new EvidenceLimit("identity_mismatch");
    return { ...value, price: p.id };
  }
  async function inspect(
    kind: ReconciliationKind,
    i: ReconciliationIdentity,
    signal?: AbortSignal,
  ): Promise<ReconciliationFacts> {
    try {
      if (kind === "mail") {
        if (profile === "production") throw new EvidenceLimit("scope_missing");
        signal?.throwIfAborted();
        const c = await d.context(i.owner, i.project, false);
        if (
          !c ||
          !c.scope || i.account !== c.scope ||
          !/^[a-f0-9]{64}$/.test(i.payloadHash ?? "") ||
          (i.mailEnvironment !== "acceptance" || !i.mailRun || !c.target?.run || i.mailRun !== c.target.run || !i.requestHash)
        )
          throw new EvidenceLimit("scope_missing");
        const e = z.object({
          reference: z.string(), occurredAt: z.iso.datetime({ offset: true }),
          scope: z.string(), requestHash: z.string().optional(), run: z.uuid().optional(),
        }).parse(await d.mail(i, signal));
        signal?.throwIfAborted();
        const fresh = await d.context(i.owner, i.project, false);
        signal?.throwIfAborted();
        if (
          !fresh || fresh.scope !== c.scope ||
          (e.requestHash !== i.requestHash || e.run !== i.mailRun || fresh.target?.run !== i.mailRun) ||
          e.scope !== i.account ||
          (i.reference && i.reference !== e.reference)
        )
          throw new EvidenceLimit("identity_mismatch");
        return {
          ...base(i),
          source: "provider_webhook",
          state: "confirmed",
          complete: true,
          reference: e.reference,
          occurredAt: e.occurredAt,
          outcome: "accepted",
        };
      }
      if (kind === "price") {
        const values = i.price
          ? [
              price.parse(
                await request(
                  i,
                  "prices/" + encodeURIComponent(i.price),
                  signal,
                ),
              ),
            ]
          : (await list(i, "prices", signal))
              .map((v) => price.parse(v))
              .filter((v) => v.metadata.attemptId === i.attempt);
        if (values.length !== 1)
          throw new EvidenceLimit(values.length ? "multiple" : "not_found");
        const p = values[0];
        if (
          !matches(p.metadata, i) ||
          p.unit_amount !== i.amount ||
          p.currency !== i.currency ||
          p.livemode !== live || (i.price != null && p.id !== i.price)
        )
          throw new EvidenceLimit("identity_mismatch");
        return {
          ...base(i),
          state: "confirmed",
          complete: true,
          reference: p.id,
          outcome: "created",
        };
      }
      const l = await readLink(i, signal);
      if (kind === "link")
        return l.active
          ? {
              ...base(i),
              state: "confirmed",
              complete: true,
              reference: l.id,
              price: l.price,
              url: l.url,
              outcome: "active",
            }
          : { ...base(i), limits: ["sessions_unresolved"] };
      const sessions = (
        await list(
          i,
          "checkout/sessions?payment_link=" + encodeURIComponent(l.id),
          signal,
        )
      ).map((v) => session.parse(v));
      if (
        sessions.some(
          (s) =>
            s.livemode !== live ||
            s.payment_link !== l.id ||
            !matches(s.metadata, i) ||
            s.amount_total !== i.amount ||
            s.currency !== i.currency,
        )
      )
        throw new EvidenceLimit("identity_mismatch");
      if (kind === "payment") {
        const paid = sessions.filter(
          (s) =>
            s.status === "complete" &&
            s.payment_status === "paid" &&
            s.payment_intent,
        );
        if (paid.length !== 1)
          throw new EvidenceLimit(paid.length ? "multiple" : "not_found");
        return {
          ...base(i),
          state: "confirmed",
          complete: true,
          reference: paid[0].id,
          link: l.id,
          paymentIntent: paid[0].payment_intent!,
          outcome: "paid",
        };
      }
      if (
        l.active ||
        sessions.some(
          (s) => s.status !== "expired" || s.payment_status !== "unpaid",
        )
      )
        throw new EvidenceLimit("sessions_unresolved");
      return {
        ...base(i),
        state: "confirmed",
        complete: true,
        reference: l.id,
        price: l.price,
        url: l.url,
        outcome: "stopped",
        sessionsSafe: true,
      };
    } catch (error) {
      return {
        ...base(i),
        limits: [
          error instanceof EvidenceLimit ? error.limit : "provider_unavailable",
        ],
      };
    }
  }
  return {
    inspect,
    stopOldLink: async (i, signal) => {
      try {
          await context(i, true, signal);
        const l = await readLink(i, signal),
          sessions = (
            await list(
              i,
              "checkout/sessions?payment_link=" + encodeURIComponent(l.id),
              signal,
            )
          ).map((v) => session.parse(v));
        if (
          sessions.some(
            (s) =>
              s.livemode !== live ||
              s.payment_link !== l.id ||
              !matches(s.metadata, i) ||
              s.amount_total !== i.amount ||
              s.currency !== i.currency ||
              s.status === "complete" ||
              s.payment_status !== "unpaid",
          )
        )
          throw new EvidenceLimit("sessions_unresolved");
        if (l.active)
          await request(
            i,
            "payment_links/" + encodeURIComponent(l.id),
            signal,
            { active: "false" },
          );
        for (const s of sessions.filter((s) => s.status === "open"))
          await request(
            i,
            "checkout/sessions/" + encodeURIComponent(s.id) + "/expire",
            signal,
            {},
          );
        return inspect("stop", { ...i, link: l.id }, signal).then((f) => ({
          ...f,
          identity: i,
        }));
      } catch (error) {
        return {
          ...base(i),
          limits: [
            error instanceof EvidenceLimit
              ? error.limit
              : "provider_unavailable",
          ],
        };
      }
    },
  };
}
