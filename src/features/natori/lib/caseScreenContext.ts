import { z } from "zod";
import { taskProjectionSchema } from "./taskProjection";
export const caseContext = z.object({
  project: taskProjectionSchema,
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  links: z.array(
    z.object({
      id: z.uuid(),
      url: z.string(),
      label: z.string().nullable(),
      sortOrder: z.number().int(),
      createdAt: z.string(),
    }),
  ),
  files: z.array(z.object({ name: z.string(), url: z.string().nullable() })),
  filesState: z.enum(["ready", "unavailable"]),
});
export type CaseContext = z.infer<typeof caseContext>;
export const casePlanning = z.array(
  z.object({
    id: z.uuid(),
    updatedAt: z.string(),
    startDate: z.iso.date().nullable(),
    dueDate: z.iso.date().nullable(),
    deliveryPlan: z.enum(["normal", "rush_14_days", "rush_7_days"]),
    priority: z.enum(["low", "normal", "high"]).nullable(),
    status: taskProjectionSchema.shape.status,
    type: z.enum(["icon", "sd", "standing", "illustration", "undecided"]),
    archivedAt: z.string().nullable(),
    tasks: z.array(
      z.object({
        id: z.uuid(),
        label: z.string(),
        stage: z.enum([
          "material",
          "rough",
          "lineart",
          "coloring",
          "finish",
          "delivery",
        ]),
        done: z.boolean(),
        estimatedHours: z.number().nullable(),
      }),
    ),
  }),
);
export type CasePlanning = z.infer<typeof casePlanning>;
