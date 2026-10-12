import assert from "node:assert/strict";
import { setDefaultResultOrder } from "node:dns";
// The owned Next listener binds localhost with IPv4 first, matching NextURL's
// canonical loopback host without exposing a non-loopback listener.
setDefaultResultOrder("ipv4first");
/** Only the two explicit loopback spellings at the fixture's actual port. */
export function localApplicationURL(input, applicationOrigin) {
  const url = new URL(input);
  const origin = new URL(applicationOrigin);
  assert.ok(
    url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port === origin.port &&
      !url.username &&
      !url.password,
    "External application redirect refused",
  );
  return url;
}

function routeClass(url) {
  const path = url.pathname.replace(/^\/(?:ja|en)(?=\/)/, "");
  const known = new Map([
    ["/api/natori/portfolio/content", "public-content"],
    ["/api/natori/admin/portfolio-content", "editor-content"],
    ["/api/natori/portfolio/upload", "image-upload"],
    ["/api/natori/portfolio/video-upload", "video-upload"],
    ["/api/natori/portfolio/video-upload/finalize", "video-finalize"],
    ["/natori/portfolio", "portfolio"],
    ["/natori/works", "works"],
    ["/natori/portfolio/contact", "contact"],
    ["/_next/image", "image-optimizer"],
    ["/og/natori-portfolio.png", "og"],
  ]);
  if (known.has(path)) return known.get(path);
  if (path.startsWith("/api/natori/portfolio/assets/")) return "public-asset";
  if (path.startsWith("/api/natori/admin/portfolio-assets/")) return "private-asset";
  if (path.startsWith("/api/natori/admin/project-thumbs/")) return "project-thumb";
  return "other";
}

/** Follow a finite chain without changing request method, headers or body. */
export async function fetchLocalApplication(
  path,
  applicationOrigin,
  init = {},
  onDiagnostic = () => {},
) {
  let url = localApplicationURL(new URL(path, applicationOrigin), applicationOrigin);
  const redirects = [];
  const method = String(init.method ?? "GET").toUpperCase();
  for (let hop = 0; hop < 5; hop++) {
    const diagnostic = {
      method: /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(method) ? method : "other",
      routeClass: routeClass(url),
      host: url.hostname,
      hop,
      status: null,
      redirects: [...redirects],
    };
    onDiagnostic(diagnostic);
    const response = await fetch(url, {
      ...init,
      redirect: "manual",
      signal: init.signal ?? AbortSignal.timeout(60_000),
    });
    diagnostic.status = response.status;
    onDiagnostic(diagnostic);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    // Redirect bodies are not needed; cancel even if destination validation fails.
    await response.body?.cancel();
    assert.ok(response.headers.get("location"), "Missing redirect destination");
    const next = localApplicationURL(
      new URL(response.headers.get("location"), url),
      applicationOrigin,
    );
    redirects.push({
      status: response.status,
      fromHost: url.hostname,
      toHost: next.hostname,
      fromRouteClass: routeClass(url),
      toRouteClass: routeClass(next),
    });
    url = next;
  }
  throw Error("Local application redirect loop");
}
