import http from "node:http";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { config, resultPath } from "./common.mjs";
import { storageProxyHeaders } from "./storage-proxy.mjs";
const upstreams = {
  auth: config.authOrigin,
  rest: config.restOrigin,
  storage: config.storageOrigin,
};
for (const origin of Object.values(upstreams)) {
  const u = new URL(origin);
  if (
    u.protocol !== "http:" ||
    !/^172\.[0-9]+\.[0-9]+\.[0-9]+$/.test(u.hostname)
  )
    throw new Error("Dedicated Docker bridge origin required");
}
http
  .createServer((req, res) => {
    const path = req.url;
    const controls = () =>
      existsSync(resultPath("control.json"))
        ? JSON.parse(readFileSync(resultPath("control.json"), "utf8"))
        : {};
    const mode = controls();
    const isCopy = req.method === "POST" && path === "/storage/v1/object/copy";
    const isAssetUpdate = req.method === "PATCH" && path.startsWith("/rest/v1/natori_portfolio_assets");
    if (isCopy) {
      const countPath = resultPath("copy-count.json");
      const count = existsSync(countPath) ? JSON.parse(readFileSync(countPath)).count : 0;
      writeFileSync(countPath, JSON.stringify({ count: count + 1 }));
    }
    if (
      (mode.failStorage && path.startsWith("/storage/v1/object/")) ||
      (mode.failCopy && isCopy) ||
      (mode.failAssetUpdate && isAssetUpdate) ||
      (mode.failFinalDownload && path.startsWith("/storage/v1/object/authenticated/natori-management-assets/portfolio/")) ||
      (mode.failContentRead &&
        req.method === "GET" &&
        path.startsWith("/rest/v1/natori_portfolio_content"))
    ) {
      res.writeHead(503, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Synthetic failure" }));
    }
    let target, rewritten;
    let headers = { ...req.headers };
    if (path.startsWith("/auth/v1/")) {
      target = upstreams.auth;
      rewritten = path.slice(8);
    } else if (path.startsWith("/rest/v1/")) {
      target = upstreams.rest;
      rewritten = path.slice(8);
    } else if (path.startsWith("/storage/v1/")) {
      target = upstreams.storage;
      rewritten = path.slice(11);
      headers = storageProxyHeaders(headers, config.api);
    } else if (path.startsWith("/graphql/v1")) {
      target = upstreams.rest;
      rewritten = "/rpc/graphql";
      headers["content-profile"] = "graphql_public";
      headers["accept-profile"] = "graphql_public";
    } else {
      res.writeHead(404);
      return res.end();
    }
    // Set the path on a fixed origin; an absolute or // path cannot redirect upstream.
    const u = new URL(target);
    const index = rewritten.indexOf("?");
    u.pathname = index < 0 ? rewritten : rewritten.slice(0, index);
    u.search = index < 0 ? "" : rewritten.slice(index);
    const outgoing = http.request(
      u,
      { method: req.method, headers },
      async (response) => {
        if (mode.loseAssetUpdateResponse && isAssetUpdate) {
          // Let real PostgREST commit, then replace only its response. A reread
          // must preserve the committed snapshot after this ambiguous failure.
          response.resume();
          res.writeHead(503, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ error: "Synthetic lost response" }));
        }
        if (mode.holdPath && path.includes(mode.holdPath)) {
          response.pause();
          writeFileSync(
            resultPath("held.json"),
            JSON.stringify({ held: true, count: existsSync(resultPath("held.json")) ? JSON.parse(readFileSync(resultPath("held.json"))).count + 1 : 1 }),
          );
          for (let count = 0; count < 200 && !controls().release; count++)
            await new Promise((resolve) => setTimeout(resolve, 25));
          if (!controls().release) {
            response.destroy();
            res.writeHead(504);
            return res.end();
          }
        }
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
      },
    );
    outgoing.on("error", () => {
      res.writeHead(502);
      res.end("isolated upstream unavailable");
    });
    req.pipe(outgoing);
  })
  .listen(new URL(config.api).port, "127.0.0.1", () =>
    console.log("Isolated gateway ready"),
  );
