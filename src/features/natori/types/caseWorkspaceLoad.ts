export class CaseWorkspaceLoadError extends Error {
  constructor(public readonly kind: "unauthorized" | "scope_unavailable" | "not_found" | "unavailable") {
    super(kind);
    this.name = "CaseWorkspaceLoadError";
  }
}
