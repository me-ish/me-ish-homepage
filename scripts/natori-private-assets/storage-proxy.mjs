import assert from "node:assert/strict";

/** Fixture-owned proxy origin/prefix, never values supplied by the caller. */
export function storageProxyHeaders(headers, apiOrigin) {
  const origin = new URL(apiOrigin);
  assert.ok(
    origin.protocol === "http:" && origin.hostname === "127.0.0.1" &&
      origin.port && !origin.username && !origin.password,
    "Owned Storage gateway origin required",
  );
  return {
    ...headers,
    "x-forwarded-host": origin.host,
    "x-forwarded-port": origin.port,
    "x-forwarded-proto": "http",
    "x-forwarded-prefix": "/storage/v1",
  };
}
