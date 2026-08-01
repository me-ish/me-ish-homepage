import type { NatoriConcreteProjectType, NatoriProject } from "@/features/natori/types/projects";

/**
 * Legacy keyword estimate registration must not infer a product type from the
 * price category (bust_up / waist_up / full_body).
 *
 * When the estimate is tied to an existing inquiry, preserve that project's
 * explicit product type. For a free-form manual estimate, use the register
 * form's neutral legacy default until the operator confirms the type.
 */
export function resolveLegacyEstimateRegistrationType(
  project: Pick<NatoriProject, "type"> | null
): NatoriConcreteProjectType {
  if (project?.type && project.type !== "undecided") return project.type;
  return "illustration";
}
