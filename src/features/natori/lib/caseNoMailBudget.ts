import { z } from "zod";

/** The retained DB limit is bookkeeping, never permission to contact a person. */
export const caseNoMailBudgetSchema = z.object({
  allowed_to: z.array(z.string()).length(0),
  human_to: z.array(z.string()).length(0),
  mail_limit: z.literal(12),
  human_limit: z.literal(0),
  used: z.literal(0),
  human_used: z.literal(0),
});
