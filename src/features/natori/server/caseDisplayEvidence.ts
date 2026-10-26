import "server-only";
import { z } from "zod";
import type { CaseSnapshot } from "../types/caseReadModel";
import type { CaseDisplayEvidence } from "../types/caseWorkspace";
import {
  absentSource, compareSourceTimes, readySource, sourceFailure, sourceId,
  sourceOccurred, sourceRows, sourceTime, type CaseSourceContext,
} from "./caseSnapshotSource";

const task = z.object({ id: sourceId, project_id: sourceId,
  stage: z.enum(["material", "rough", "lineart", "coloring", "finish", "delivery"]),
  done: z.boolean(), sort_order: z.number().int() });
const message = z.object({ id: sourceId, project_id: sourceId,
  sender: z.enum(["staff", "client"]), created_at: sourceTime });

/** Preserve known display fields without inventing origin, event times or unread state. */
export function adaptCaseDisplayEvidence(ctx: CaseSourceContext, snapshot: CaseSnapshot): CaseDisplayEvidence {
  const tasks = sourceRows(ctx, "lifecycle_tasks", task);
  const messages = sourceRows(ctx, "lifecycle_consultation", message);
  const knownReceipt = snapshot.receipt.state === "ready" ? snapshot.receipt.value : null;
  const knownPayment = snapshot.payment.state === "ready" ? snapshot.payment.value : null;
  const projectedPaymentAt = ctx.project.payment_confirmed_at ?? ctx.project.paid_at;
  return {
    project: readySource(ctx, { id: ctx.project.id, rawStatus: ctx.project.status, type: ctx.project.type,
      archivedAt: ctx.project.deleted_at,
      origin: snapshot.project.state === "ready" && snapshot.project.value.origin === "internal" ? "internal" : "unknown" }),
    tasks: tasks.state !== "ready" ? sourceFailure(tasks) : tasks.rows.length === 0 ? absentSource(ctx)
      : readySource(ctx, [...tasks.rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
        .map(row => ({ id: row.id, stage: row.stage, done: row.done }))),
    conversation: messages.state !== "ready" ? sourceFailure(messages)
      : messages.rows.some(row => !sourceOccurred(ctx, row.created_at))
        ? { state: "unavailable", reason: "incomplete" }
        : messages.rows.length === 0 ? absentSource(ctx)
          : readySource(ctx, (() => {
            const latest = [...messages.rows].sort((a, b) => compareSourceTimes(b.created_at, a.created_at)
              || b.id.localeCompare(a.id))[0];
            return { latestSender: latest.sender, latestAt: latest.created_at };
          })()),
    payment: knownPayment ? readySource(ctx, { confirmedAt: knownPayment.confirmedAt, money: knownPayment.money,
      method: knownPayment.method, correspondence: knownPayment.source === "legacy_projection" ? "unconfirmed" : "matched" })
      : projectedPaymentAt ? readySource(ctx, { confirmedAt: projectedPaymentAt,
        money: ctx.project.paid_amount === null ? null : { amount: ctx.project.paid_amount, currency: "JPY" },
        method: "project_projection", correspondence: "unconfirmed" })
        : snapshot.payment.state === "absent" ? absentSource(ctx)
          : snapshot.payment.state === "not_requested" ? { state: "not_requested" }
            : { state: "unavailable", reason: snapshot.payment.state === "unavailable" ? snapshot.payment.reason : "incomplete" },
    receipt: knownReceipt ? readySource(ctx, { acceptedAt: knownReceipt.acceptedAt,
      deliveryId: knownReceipt.deliveryId, correspondence: "matched" })
      : ctx.project.delivery_accepted_at ? readySource(ctx, { acceptedAt: ctx.project.delivery_accepted_at,
        deliveryId: null, correspondence: "unconfirmed" })
        : snapshot.receipt.state === "absent" ? absentSource(ctx)
          : snapshot.receipt.state === "not_requested" ? { state: "not_requested" }
            : { state: "unavailable", reason: snapshot.receipt.state === "unavailable" ? snapshot.receipt.reason : "incomplete" },
  };
}
