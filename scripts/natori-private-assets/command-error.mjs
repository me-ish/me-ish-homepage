/** A command error may contain Docker JWT --env arguments; never expose it. */
export function commandFailure(error, command, operation) {
  const status = typeof error.status === "number" ? error.status : null;
  const signal = ["SIGTERM", "SIGKILL", "SIGABRT"].includes(error.signal)
    ? error.signal
    : null;
  const sqlCode =
    String(error.stderr ?? "").match(/SEC01_[A-Z_]+/)?.[0] ?? null;
  const result = new Error(
    `Isolated command failed: ${command} ${operation}; status=${status}; signal=${signal}; code=${sqlCode}`,
  );
  result.name = "IsolatedCommandError";
  return result;
}
