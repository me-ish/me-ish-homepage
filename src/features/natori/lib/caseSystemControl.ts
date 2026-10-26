import { z } from "zod";

export const caseSystemReviewSchema = z.object({
  owner: z.uuid(), generation: z.number().int().nonnegative().safe(),
  armed: z.boolean(), commandsHeld: z.boolean(), sendersHeld: z.boolean(), readOnly: z.boolean(),
  revision: z.string().regex(/^[0-9a-f]{32}$/),
  localUnknownRecords: z.number().int().nonnegative().safe(),
  localInFlightRecords: z.number().int().nonnegative().safe(),
  recordsComplete: z.literal(true),
  records: z.array(z.object({kind:z.enum(["notification","legacy-mail","legacy-consultation","payment-ledger","link-attempt","payment-operation","current-operation","link-stop","reconciliation","stripe-event","refund","intake","consultation","upload-credential","delivery-file"]),id:z.string().min(1).max(500),projectId:z.uuid().nullable(),status:z.string(),leaseUntil:z.string().nullable(),unresolved:z.boolean(),inFlight:z.boolean()})),
  externalAbsenceProven: z.literal(false), priorRequestsMayComplete: z.literal(true),
  scope: z.literal("local-ledgers-only"),
});
export type CaseSystemReview = z.infer<typeof caseSystemReviewSchema>;
export const caseSystemControlInputSchema = z.strictObject({
  action: z.enum(["hold", "read-only", "resume-commands", "resume-senders"]),
  generation: z.number().int().nonnegative().safe(),
  revision: z.string().regex(/^[0-9a-f]{32}$/).nullable(),
  acknowledgePrior: z.boolean(),
}).refine(v => !v.action.startsWith("resume-") || (v.revision !== null && v.acknowledgePrior));
export type CaseSystemControlInput = z.infer<typeof caseSystemControlInputSchema>;
