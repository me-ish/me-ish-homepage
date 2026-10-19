import { z } from "zod";
const timestamp=z.string().datetime({offset:true});
export const paymentStopStatusSchema=z.discriminatedUnion("enabled",[
 z.object({enabled:z.literal(false)}),
 z.object({enabled:z.literal(true),checkedAt:timestamp,unresolved:z.number().int().nonnegative(),oldestAt:timestamp.nullable(),
  jobs:z.array(z.object({id:z.uuid(),projectId:z.uuid(),title:z.string(),status:z.enum(["pending","processing","needs_review"]),createdAt:timestamp,leaseUntil:timestamp.nullable()})),
  lastRun:z.object({startedAt:timestamp,finishedAt:timestamp.nullable(),outcome:z.enum(["ok","partial","db-error","not-configured"]).nullable(),failed:z.number().int().nonnegative().nullable()}).nullable(),
  lastCompletedAt:timestamp.nullable()})
]);
export type PaymentStopStatus=z.infer<typeof paymentStopStatusSchema>;
