/** A socket-only initialization server cannot satisfy these TCP probes. */
export function postgresReady(call, container) {
  try {
    call("docker", [
      "exec",
      container,
      "pg_isready",
      "--quiet",
      "-h",
      "127.0.0.1",
      "-p",
      "5432",
      "-U",
      "postgres",
    ]);
    return (
      call("docker", [
        "exec",
        container,
        "psql",
        "-X",
        "-q",
        "-t",
        "-A",
        "-h",
        "127.0.0.1",
        "-p",
        "5432",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-c",
        "SELECT 1;",
      ]).trim() === "1"
    );
  } catch {
    return false;
  }
}
