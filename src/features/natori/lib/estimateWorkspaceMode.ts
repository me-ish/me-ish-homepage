export type EstimateWorkspaceMode =
  | "manual"
  | "not-found"
  | "legacy"
  | "structured";

export function resolveEstimateWorkspaceMode(args: {
  inquiryId: string | null;
  projectFound: boolean;
  hasRequestData: boolean;
}): EstimateWorkspaceMode {
  if (!args.inquiryId) return "manual";
  if (!args.projectFound) return "not-found";
  return args.hasRequestData ? "structured" : "legacy";
}
