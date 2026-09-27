import { AsyncLocalStorage } from "node:async_hooks";

type Event = {
  actor: number;
  operation: string;
  startedMs: number;
  elapsedMs: number;
  status: number;
  error?: string;
};
type Trace = { started: number; events: Event[]; barrier?: () => Promise<void> };

// Test-only observer. Product source, HTTP responses, credentials and URLs are
// never rewritten or logged. Only the verified disposable Storage is allowed.
export function observeStorage(origin: string, stagingBucket: string) {
  if (!/^http:\/\/172\.30\.250\.\d+:8000$/.test(origin))
    throw new Error("DIAGNOSTIC_DESTINATION_REJECTED");
  const context = new AsyncLocalStorage<{ trace: Trace; actor: number }>();
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const active = context.getStore();
    if (!active) return original(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin !== origin) throw new Error("DIAGNOSTIC_DESTINATION_REJECTED");
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const p = url.pathname;
    const area = p.includes(`/artworks/`) ? "published" :
      p.includes(`/${stagingBucket}`) ? "staging" : "other";
    const operation = `${area}-${p.includes("/object/info/") ? "info" :
      method === "POST" ? "upload" : method === "DELETE" ? "delete" : "download"}`;
    if (operation === "published-upload") await active.trace.barrier?.();
    const start = performance.now();
    const event: Event = {actor: active.actor, operation,
      startedMs: Math.round(start - active.trace.started), elapsedMs: 0, status: 0};
    active.trace.events.push(event);
    try {
      const response = await original(input, init);
      event.status = response.status;
      if (!response.ok) {
        const data: unknown = await response.clone().json().catch(() => null);
        const message = data && typeof data === "object" && "message" in data
          ? String(data.message) : "";
        const code = data && typeof data === "object" && "code" in data
          ? String(data.code) : "";
        const allowed = ["NoSuchKey", "NoSuchBucket", "KeyAlreadyExists",
          "ResourceAlreadyExists", "ResourceLocked", "LockTimeout", "AccessDenied",
          "InvalidJWT", "DatabaseError", "DatabaseTimeout", "InternalError"];
        event.error = allowed.includes(code) ? code :
          /^object not found$/i.test(message) ? "ObjectNotFound" :
          /^bucket not found$/i.test(message) ? "BucketNotFound" :
          /already exists/i.test(message) ? "AlreadyExists" :
          /lock/i.test(message) ? "LockError" : "UnclassifiedStorageError";
      }
      return response;
    } catch {
      event.error = "FetchException";
      throw new Error("DIAGNOSTIC_FETCH_EXCEPTION");
    } finally {
      event.elapsedMs = Math.round(performance.now() - start);
    }
  };
  return {
    async pair<T>(fn: () => Promise<T>, synchronized: boolean) {
      let arrived = 0;
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const trace: Trace = {started: performance.now(), events: []};
      if (synchronized) trace.barrier = async () => {
        if (++arrived === 2) release();
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([gate, new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("UPLOAD_BARRIER_TIMEOUT")), 5000);
          })]);
        } finally { if (timer) clearTimeout(timer); }
      };
      const results = await Promise.allSettled([1, 2].map((actor) =>
        context.run({trace, actor}, fn)));
      return {results, events: trace.events};
    },
    restore() { globalThis.fetch = original; },
  };
}
