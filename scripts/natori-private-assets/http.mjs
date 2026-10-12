import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { createHash } from "node:crypto";
import { fetchLocalApplication } from "./local-redirect.mjs";
import { execFileSync } from "node:child_process";
import { config, resultPath } from "./common.mjs";
let fixtureDiagnostic = null;
const fixtureFetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  assert.equal(url.origin, config.api, "External fixture request refused");
  const method = String(init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const diagnostic = {
    service: url.pathname.startsWith("/storage/v1/") ? "storage" :
      url.pathname.startsWith("/auth/v1/") ? "auth" : "data-api",
    routeClass: url.pathname.startsWith("/storage/v1/upload/resumable/sign") ? "signed-tus" :
      url.pathname.startsWith("/storage/v1/upload/resumable") ? "unsigned-tus" : "other",
    method: /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)$/.test(method) ? method : "other",
    status: null,
    errorCode: null,
  };
  fixtureDiagnostic = diagnostic;
  const response = await fetch(input, {
    ...init,
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(60_000),
  });
  diagnostic.status = response.status;
  if (!response.ok && diagnostic.routeClass.endsWith("tus")) {
    // Inspect only a bounded response to classify known protocol errors. Never
    // expose returned message text, object paths, bearer tokens or request data.
    const reader = response.body?.getReader();
    if (reader) {
      const chunk = await reader.read();
      await reader.cancel();
      const value = chunk.value?.byteLength <= 1024
        ? Buffer.from(chunk.value).toString("utf8") : "";
      for (const code of ["InvalidSignature", "InvalidUploadSignature", "AccessDenied", "ExpiredToken", "KeyAlreadyExists", "InvalidUploadId", "InvalidRequest"])
        if (new RegExp(`\\b${code}\\b`).test(value)) { diagnostic.errorCode = code; break; }
    }
  }
  return response;
};
const otherClient = createClient(config.api, config.anon, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: fixtureFetch,
    headers: {
      Authorization: "Bearer " + config.users[1].session.access_token,
    },
  },
});
const uploadClient = createClient(config.api, config.anon, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fixtureFetch },
});
const admin = createClient(config.api, config.service, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fixtureFetch },
  }),
  results = [];
const record = (name) => {
  results.push({ name, status: "pass" });
  console.log("PASS " + name);
};
const cookie = (user) =>
  "sb-127-auth-token=base64-" +
  Buffer.from(JSON.stringify(user.session)).toString("base64url");
const manager = {
    Cookie: cookie(config.users[0]),
    "x-requested-with": "me-ish",
  },
  other = { Cookie: cookie(config.users[1]), "x-requested-with": "me-ish" };
let requestDiagnostic = null;
const api = (path, init = {}) =>
    fetchLocalApplication(path, config.app, init, (value) => {
      requestDiagnostic = value;
    }),
  json = async (path, init = {}) => {
    const r = await api(path, init);
    return { status: r.status, data: await r.json() };
  };
const clone = (v) => JSON.parse(JSON.stringify(v));
let inputCase = null;
const body = (value) => ({
  method: "PUT",
  headers: { ...manager, "Content-Type": "application/json" },
  body: JSON.stringify(value),
});
let failure = null;
try {
  const readinessDeadline = Date.now() + 90_000;
  let ready = false;
  for (let i = 0; i < 180 && Date.now() < readinessDeadline; i++) {
    try {
      if (
        (
          await api("/api/natori/portfolio/content", {
            signal: AbortSignal.timeout(5_000),
          })
        ).ok
      ) {
        ready = true;
        break;
      }
    } catch {}
    if (i === 179) throw Error("Next not ready");
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, "Next not ready within finite startup deadline");
  for (const headers of [{}, other])
    assert.equal(
      (await api("/api/natori/admin/portfolio-content", { headers })).status,
      401,
    );
  record("anonymous and unrelated Auth user cannot load full editor content");
  for (const headers of [{}, other]) {
    assert.equal(
      (
        await api("/api/natori/portfolio/video-upload", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ sizeBytes: 24, contentType: "video/mp4" }),
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await api("/api/natori/portfolio/content", {
          ...body({ content: {}, expectedRevision: 0 }),
          headers: { ...headers, "Content-Type": "application/json" },
        })
      ).status,
      401,
    );
  }
  const unrelatedIdentity = await otherClient.auth.getUser(
    config.users[1].session.access_token,
  );
  assert.equal(unrelatedIdentity.data.user?.id, config.users[1].id);
  for (const client of [uploadClient, otherClient]) {
    const data = await client
      .from("natori_portfolio_content")
      .select("content");
    assert.ok(data.error);
    const assets = await client.from("natori_portfolio_assets").select("*");
    assert.ok(assets.error);
  }
  record(
    "anonymous and other-user writes denied; content and metadata inaccessible through browser Data API",
  );
  const control = (value) =>
    writeFileSync(resultPath("control.json"), JSON.stringify(value));
  const waitHeld = async () => {
    for (let n = 0; n < 160; n++) {
      if (existsSync(resultPath("held.json"))) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw Error("Synthetic hold was not observed");
  };
  const clearHold = () => {
    control({});
    if (existsSync(resultPath("held.json")))
      unlinkSync(resultPath("held.json"));
  };

  let state = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  assert.equal(state.status, 200);
  const base = JSON.parse(readFileSync(resultPath("content.json")));
  let saved = await json(
    "/api/natori/portfolio/content",
    body({ content: base, expectedRevision: state.data.revision }),
  );
  assert.equal(saved.status, 200);
  state = saved;
  async function upload(projectId) {
    const form = new FormData();
    form.set(
      "file",
      new Blob([readFileSync(resultPath("image.webp"))], {
        type: "image/webp",
      }),
      "fixture.webp",
    );
    if (projectId) form.set("projectId", projectId);
    return json(
      projectId
        ? "/api/natori/admin/project-thumbs"
        : "/api/natori/portfolio/upload",
      { method: "POST", headers: manager, body: form },
    );
  }
  const thumb = await upload(config.projects[0]);
  assert.equal(thumb.status, 200);
  assert.ok(thumb.data.url.startsWith("/api/natori/admin/project-thumbs/"));
  assert.equal((await api(thumb.data.url)).status, 401);
  assert.equal((await api(thumb.data.url, { headers: other })).status, 401);
  assert.equal((await api(thumb.data.url, { headers: manager })).status, 200);
  assert.equal((await upload(config.projects[1])).status, 500);
  record(
    "private project thumbnails require manager authorization and target-owner scope",
  );
  const browserWrite = await uploadClient.storage
    .from("natori-management-assets")
    .upload(
      "project-thumbs/" +
        config.users[0].id +
        "/" +
        config.projects[0] +
        ".webp",
      readFileSync(resultPath("image.webp")),
      { contentType: "image/webp", upsert: true },
    );
  assert.ok(browserWrite.error);
  const unrelatedWrite = await otherClient.storage
    .from("natori-management-assets")
    .upload(
      "project-thumbs/" +
        config.users[0].id +
        "/" +
        config.projects[0] +
        ".webp",
      readFileSync(resultPath("image.webp")),
      { contentType: "image/webp", upsert: true },
    );
  assert.ok(unrelatedWrite.error);

  const list = await json("/api/natori/admin/project-thumbs", {
    headers: manager,
  });
  assert.equal(list.status, 200);
  assert.ok(JSON.stringify(list.data).includes(config.projects[0]));
  assert.ok(!JSON.stringify(list.data).includes(config.projects[1]));
  assert.equal(
    (
      await api("/api/natori/admin/project-thumbs/" + config.projects[1], {
        headers: manager,
      })
    ).status,
    404,
  );
  control({
    holdPath:
      "project-thumbs/" +
      config.users[0].id +
      "/" +
      config.projects[0] +
      ".webp",
  });
  const reassigned = api(thumb.data.url, { headers: manager });
  await waitHeld();
  assert.ok(
    !(
      await admin
        .from("natori_projects")
        .update({ user_id: config.users[1].id })
        .eq("id", config.projects[0])
    ).error,
  );
  control({ release: true });
  assert.equal((await reassigned).status, 404);
  clearHold();
  assert.ok(
    !(
      await admin
        .from("natori_projects")
        .update({ user_id: config.users[0].id })
        .eq("id", config.projects[0])
    ).error,
  );
  record(
    "browser Storage writes and foreign thumbnail reads denied; ownership reassignment during download fails closed",
  );

  const legacyURL =
    config.api +
    "/storage/v1/object/public/natori-portfolio/project-thumbs/" +
    config.projects[0] +
    ".webp";
  assert.equal((await fixtureFetch(legacyURL)).status, 200);
  record(
    "legacy public thumbnail URL remains a qualified migration/CDN gate; gallery bucket preserved",
  );
  for (const [label, bytes, type] of [
    ["invalid_bytes", Buffer.from("invalid-image"), "image/png"],
    ["too_large", Buffer.alloc(10 * 1024 * 1024 + 1), "image/png"],
    ["invalid_mime", Buffer.from("invalid-type"), "text/html"],
  ]) {
    inputCase = label;
    const form = new FormData();
    form.set("file", new Blob([bytes], { type }), "invalid.fixture");
    assert.equal(
      (
        await json("/api/natori/portfolio/upload", {
          method: "POST",
          headers: manager,
          body: form,
        })
      ).status,
      400,
    );
  }
  inputCase = null;
  record(
    "invalid image bytes, MIME and over-limit upload inputs are rejected before publication",
  );
  inputCase = "valid_exact_max_image";
  const exactImage = Buffer.alloc(10 * 1024 * 1024);
  readFileSync(resultPath("image.webp")).copy(exactImage);
  const exactForm = new FormData();
  exactForm.set(
    "file",
    new Blob([exactImage], { type: "image/webp" }),
    "exact-max.webp",
  );
  const exactUploaded = await json("/api/natori/portfolio/upload", {
    method: "POST",
    headers: manager,
    body: exactForm,
  });
  assert.equal(exactUploaded.status, 200);
  assert.equal(
    (await api(exactUploaded.data.url, { headers: manager })).status,
    200,
  );
  assert.equal(
    (
      await api(
        exactUploaded.data.url.replace(
          "/admin/portfolio-assets/",
          "/portfolio/assets/",
        ),
      )
    ).status,
    404,
  );
  inputCase = null;
  record(
    "valid exact10MiB image including multipart overhead uploads privately; file ceiling stays enforced",
  );

  const uploaded = await upload();
  assert.equal(uploaded.status, 200);
  const imageURL = uploaded.data.url;
  assert.ok(imageURL.startsWith("/api/natori/admin/portfolio-assets/"));
  const publicURL = imageURL.replace(
    "/admin/portfolio-assets/",
    "/portfolio/assets/",
  );
  assert.equal((await api(imageURL)).status, 401);
  assert.equal((await api(imageURL, { headers: manager })).status, 200);
  assert.equal((await api(publicURL)).status, 404);
  const assetId = imageURL.split("/").at(-1).split(".")[0];
  const meta = await admin
    .from("natori_portfolio_assets")
    .select("path,byte_size")
    .eq("id", assetId)
    .single();
  assert.ok(!meta.error);
  const storedImage = await admin.storage
    .from("natori-management-assets")
    .download(meta.data.path);
  assert.ok(!storedImage.error && storedImage.data);
  const storedImageBytes = Buffer.from(await storedImage.data.arrayBuffer());
  assert.equal(storedImageBytes.length, meta.data.byte_size);

  assert.notEqual(
    (
      await fixtureFetch(
        config.api +
          "/storage/v1/object/public/natori-management-assets/" +
          meta.data.path,
      )
    ).status,
    200,
  );
  record(
    "upload-before-save is private at both direct Storage and application URLs",
  );
  const privateWork = {
    ...base.works[0],
    id: "private-work",
    title: "PRIVATE_TITLE_CANARY",
    image: imageURL,
    published: false,
    relatedLinks: [
      {
        id: "private-link",
        kind: "usage",
        label: "PRIVATE_LINK_CANARY",
        href: "https://private.invalid/PRIVATE_LINK_CANARY",
      },
    ],
  };
  const content = {
    ...base,
    works: [...base.works, privateWork],
    heroImages: [imageURL, base.heroImage],
    heroImage: imageURL,
    aboutImage: imageURL,
    plans: base.plans.map((p, i) =>
      i === 0 ? { ...p, sampleWorkId: privateWork.id } : p,
    ),
    processVideo: {
      url: "https://youtu.be/abcdefghijk",
      caption: "PRIVATE_VIDEO_CANARY",
      published: false,
    },
  };
  saved = await json(
    "/api/natori/portfolio/content",
    body({ content, expectedRevision: state.data.revision }),
  );
  assert.equal(saved.status, 200);
  state = saved;
  for (const path of [
    "/api/natori/portfolio/content",
    "/natori/portfolio",
    "/natori/works",
    "/natori/portfolio/contact",
  ]) {
    const r = await api(path),
      text = await r.text();
    assert.equal(r.status, 200);
    assert.ok(
      !text.includes("PRIVATE_") && !text.includes(assetId),
      path + " leaked private markers",
    );
  }
  const rsc = await api("/natori/portfolio?_rsc=sec01", {
    headers: { RSC: "1" },
  });
  assert.equal(rsc.status, 200);
  assert.ok(
    (rsc.headers.get("content-type") ?? "").includes("text/x-component"),
  );
  const rscText = await rsc.text();
  assert.ok(!rscText.includes("PRIVATE_") && !rscText.includes(assetId));
  record(
    "public API/HTML/RSC/contact/showcase omit private work, URL, links and video markers",
  );
  const editor = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  assert.ok(JSON.stringify(editor.data).includes("PRIVATE_TITLE_CANARY"));
  assert.equal((await api(publicURL)).status, 404);
  content.works[1].published = true;
  content.heroImage = base.heroImage;
  content.heroImages = [base.heroImage];
  content.aboutImage = base.heroImage;
  saved = await json(
    "/api/natori/portfolio/content",
    body({ content, expectedRevision: state.data.revision }),
  );
  assert.equal(saved.status, 200);
  state = saved;
  let image = await api(publicURL);
  assert.equal(image.status, 200);
  assert.ok(image.headers.get("cache-control").includes("no-store"));
  assert.ok(Buffer.from(await image.arrayBuffer()).equals(storedImageBytes));
  assert.equal(
    (
      await api(
        "/_next/image?url=" + encodeURIComponent(publicURL) + "&w=640&q=75",
      )
    ).status,
    400,
  );
  record(
    "published new image is readable only through no-store origin; optimizer cache bypass blocked",
  );
  const doubleEncoded = publicURL.replace(
    assetId,
    "%25" + assetId.charCodeAt(0).toString(16) + assetId.slice(1),
  );
  assert.equal((await api(doubleEncoded)).status, 404);
  const legacyOptimized = await api(
    "/_next/image?url=" +
      encodeURIComponent("/sec01-fixture-gallery.webp") +
      "&w=640&q=75",
  );
  assert.equal(legacyOptimized.status, 200);
  assert.ok(
    (legacyOptimized.headers.get("content-type") ?? "").startsWith("image/"),
  );
  for (const url of [
    imageURL + "?v=alias",
    publicURL + "/",
    publicURL.replace("/natori/", "//natori//"),
    "/og//natori-portfolio.png/",
    publicURL.replace("/api/", "/%61pi/"),
    config.app + publicURL,
    thumb.data.url,
    "/og/natori-portfolio.png",
  ])
    assert.equal(
      (await api("/_next/image?url=" + encodeURIComponent(url) + "&w=640&q=75"))
        .status,
      400,
    );
  record(
    "managed URL optimizer aliases denied; existing public gallery image optimization still works",
  );
  control({ failStorage: true });
  let failed = await api(publicURL);
  assert.equal(failed.status, 503);
  assert.ok(failed.headers.get("cache-control").includes("no-store"));
  clearHold();
  control({ failContentRead: true });
  failed = await api(publicURL);
  assert.equal(failed.status, 503);
  assert.equal(
    (await api("/api/natori/admin/portfolio-content", { headers: manager }))
      .status,
    500,
  );
  clearHold();
  record(
    "Storage and publication-state read failures deny media and full editor content without cache",
  );
  control({ holdPath: meta.data.path });
  const raced = api(publicURL);
  await waitHeld();
  const racedState = await admin
    .from("natori_portfolio_content")
    .select("content,revision")
    .eq("id", "main")
    .single();
  racedState.data.content.works[1].published = false;
  assert.ok(
    !(
      await admin
        .from("natori_portfolio_content")
        .update({ content: racedState.data.content })
        .eq("id", "main")
    ).error,
  );
  control({ release: true });
  assert.equal((await raced).status, 404);
  clearHold();
  let refreshed = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  refreshed.data.content.works[1].published = true;
  state = await json(
    "/api/natori/portfolio/content",
    body({
      content: refreshed.data.content,
      expectedRevision: refreshed.data.revision,
    }),
  );
  assert.equal(state.status, 200);
  record(
    "unpublication while Storage is in flight is rechecked before media bytes are released",
  );
  const foreignId = crypto.randomUUID(),
    foreignPath = "portfolio/" + config.users[1].id + "/" + foreignId + ".webp";
  assert.ok(
    !(
      await admin.storage
        .from("natori-management-assets")
        .upload(foreignPath, readFileSync(resultPath("image.webp")), {
          contentType: "image/webp",
        })
    ).error,
  );
  assert.ok(
    !(
      await admin.from("natori_portfolio_assets").insert({
        id: foreignId,
        owner_id: config.users[1].id,
        kind: "image",
        path: foreignPath,
        byte_size: readFileSync(resultPath("image.webp")).length,
        ready: true,
      })
    ).error,
  );
  const foreignURL =
    "/api/natori/admin/portfolio-assets/" + foreignId + ".webp";
  refreshed = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  assert.equal(
    (
      await json(
        "/api/natori/portfolio/content",
        body({
          content: {
            ...refreshed.data.content,
            heroImage: foreignURL,
            heroImages: [foreignURL],
          },
          expectedRevision: refreshed.data.revision,
        }),
      )
    ).status,
    400,
  );
  assert.equal((await api(foreignURL, { headers: manager })).status, 404);
  assert.equal(
    (
      await api(
        foreignURL.replace("/admin/portfolio-assets/", "/portfolio/assets/"),
      )
    ).status,
    404,
  );
  record(
    "another owner ready asset cannot be committed or read by the management target",
  );

  const versions = await Promise.all(
    ["A", "B"].map((label) =>
      json(
        "/api/natori/portfolio/content",
        body({
          content: { ...content, artistName: "Concurrent " + label },
          expectedRevision: state.data.revision,
        }),
      ),
    ),
  );
  assert.deepEqual(versions.map((v) => v.status).sort(), [200, 409]);
  state = versions.find((v) => v.status === 200);
  record(
    "two concurrent saves commit once; stale request receives conflict without overwriting",
  );
  const current = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  current.data.content.works[1].published = false;
  saved = await json(
    "/api/natori/portfolio/content",
    body({
      content: current.data.content,
      expectedRevision: current.data.revision,
    }),
  );
  assert.equal(saved.status, 200);
  state = saved;
  assert.equal((await api(publicURL)).status, 404);
  assert.equal((await api(imageURL, { headers: manager })).status, 200);
  record(
    "publish-to-unpublish closes the new known URL while manager access remains",
  );
  const og = await api("/og/natori-portfolio.png");
  assert.equal(og.status, 200);
  assert.ok(og.headers.get("cache-control").includes("no-store"));
  const ogBefore = createHash("sha256")
    .update(Buffer.from(await og.arrayBuffer()))
    .digest("hex");
  const hiddenOnly = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  const hiddenMutation = hiddenOnly.data.content;
  hiddenMutation.works[1].title = "PRIVATE_OG_TITLE_CANARY";
  hiddenMutation.works[1].image = config.app + publicURL;
  hiddenMutation.works[1].relatedLinks = [
    {
      id: "private-og",
      kind: "usage",
      label: "PRIVATE_OG_LINK_CANARY",
      href: "https://private.invalid/PRIVATE_OG_LINK_CANARY",
    },
  ];
  hiddenMutation.heroImages = [publicURL + "/", ...hiddenMutation.heroImages];
  hiddenMutation.processVideo.caption = "PRIVATE_OG_CAPTION_CANARY";
  hiddenMutation.massProductionSamples = [
    ...(hiddenMutation.massProductionSamples ?? []),
    {
      id: "private-og-sample",
      name: "PRIVATE_OG_SAMPLE_CANARY",
      image: publicURL,
    },
  ];
  // Simulate an older saved absolute alias directly in this synthetic fixture;
  // the current editor API intentionally refuses nonlocal managed references.
  assert.ok(
    !(
      await admin
        .from("natori_portfolio_content")
        .update({ content: hiddenMutation })
        .eq("id", "main")
    ).error,
  );
  const ogAfter = await api("/og/natori-portfolio.png");
  assert.equal(ogAfter.status, 200);
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(await ogAfter.arrayBuffer()))
      .digest("hex"),
    ogBefore,
    "Hidden-only changes must not affect rendered OG bytes",
  );
  // Restore canonical editor state before continuing the upload lifecycle.
  hiddenMutation.works[1].image = imageURL;
  hiddenMutation.heroImages = hiddenMutation.heroImages.slice(1);
  assert.ok(
    !(
      await admin
        .from("natori_portfolio_content")
        .update({ content: hiddenMutation })
        .eq("id", "main")
    ).error,
  );
  assert.equal(
    (
      await api(
        "/_next/image?url=" +
          encodeURIComponent("/og/natori-portfolio.png") +
          "&w=640&q=75",
      )
    ).status,
    400,
  );
  record(
    "OG uses public projection and cannot be retained by the application optimizer",
  );
  const video = readFileSync(resultPath("video.mp4"));
  const prep = await json("/api/natori/portfolio/video-upload", {
    method: "POST",
    headers: { ...manager, "Content-Type": "application/json" },
    body: JSON.stringify({ sizeBytes: video.length, contentType: "video/mp4" }),
  });
  assert.equal(prep.status, 200);
  assert.equal(prep.data.bucket, "natori-management-assets");
  const videoUpload = await uploadClient.storage
    .from(prep.data.bucket)
    .uploadToSignedUrl(prep.data.path, prep.data.token, video, {
      contentType: "video/mp4",
      cacheControl: "0",
    });
  assert.ok(!videoUpload.error);
  const wrongPath = await uploadClient.storage
    .from(prep.data.bucket)
    .uploadToSignedUrl(
      prep.data.path.replace(".mp4", "-other.mp4"),
      prep.data.token,
      video,
      { contentType: "video/mp4" },
    );
  assert.ok(wrongPath.error);
  const wrongBucket = await uploadClient.storage
    .from("natori-portfolio")
    .uploadToSignedUrl(prep.data.path, prep.data.token, video, {
      contentType: "video/mp4",
    });
  assert.ok(wrongBucket.error);
  const replay = await uploadClient.storage
    .from(prep.data.bucket)
    .uploadToSignedUrl(prep.data.path, prep.data.token, video, {
      contentType: "video/mp4",
      upsert: true,
    });
  assert.ok(replay.error);
  const forged = await fixtureFetch(
    config.api +
      "/storage/v1/object/upload/sign/" +
      prep.data.bucket +
      "/" +
      prep.data.path +
      "?token=" +
      encodeURIComponent(prep.data.token),
    {
      method: "PUT",
      headers: {
        apikey: config.anon,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body: video,
    },
  );
  assert.ok(!forged.ok);
  const tusMetadata = Object.entries({
    bucketName: prep.data.bucket,
    objectName: prep.data.path,
    contentType: "video/mp4",
    cacheControl: "0",
  })
    .map(([key, value]) => key + " " + Buffer.from(value).toString("base64"))
    .join(",");
  const tus = await fixtureFetch(config.api + "/storage/v1/upload/resumable/sign", {
    method: "POST",
    headers: {
      apikey: config.anon,
      "x-signature": prep.data.token,
      "x-upsert": "true",
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(video.length),
      "Upload-Metadata": tusMetadata,
    },
  });
  if (tus.ok) {
    const location = new URL(tus.headers.get("location"), config.api);
    assert.equal(location.origin, config.api, "External TUS redirect refused");
    const patch = await fixtureFetch(location, {
      method: "PATCH",
      headers: {
        apikey: config.anon,
        "x-signature": prep.data.token,
        "x-upsert": "true",
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream",
      },
      body: video,
    });
    assert.ok(!patch.ok);
  } else assert.ok([400, 401, 403, 404, 409, 501].includes(tus.status));
  const tusAttempt = async (
    prepared,
    bytes,
    { bucket = prepared.bucket, path = prepared.path, upsert = false } = {},
  ) => {
    const metadata = Object.entries({
      bucketName: bucket,
      objectName: path,
      contentType: "video/mp4",
      cacheControl: "0",
    })
      .map(([key, value]) => key + " " + Buffer.from(value).toString("base64"))
      .join(",");
    const created = await fixtureFetch(
      config.api + "/storage/v1/upload/resumable/sign",
      {
        method: "POST",
        headers: {
          "x-signature": prepared.token,
          "x-upsert": String(upsert),
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(bytes.length),
          "Upload-Metadata": metadata,
        },
      },
    );
    if (created.status !== 201) return false;
    const url = new URL(created.headers.get("location"), config.api);
    assert.equal(url.origin, config.api, "External TUS destination refused");
    const result = await fixtureFetch(url, {
      method: "PATCH",
      headers: {
        "x-signature": prepared.token,
        "x-upsert": String(upsert),
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream",
      },
      body: bytes,
    });
    return result.status === 204;
  };
  const wrongTusPath = prep.data.path.replace(".mp4", "-foreign.mp4");
  assert.equal(await tusAttempt({ ...prep.data, token: "" }, video), false);
  assert.equal(
    await tusAttempt({ ...prep.data, token: "SYNTHETIC_INVALID_SIGNATURE" }, video),
    false,
  );
  assert.equal(
    await tusAttempt(prep.data, video, { path: wrongTusPath }),
    false,
  );
  assert.equal(
    await tusAttempt(prep.data, video, { bucket: "natori-portfolio" }),
    false,
  );
  assert.ok(
    (await admin.storage.from(prep.data.bucket).info(wrongTusPath)).error,
  );
  assert.ok(
    (await admin.storage.from("natori-portfolio").info(prep.data.path)).error,
  );
  const freshForgery = await json("/api/natori/portfolio/video-upload", {
    method: "POST",
    headers: { ...manager, "Content-Type": "application/json" },
    body: JSON.stringify({ sizeBytes: video.length, contentType: "video/mp4" }),
  });
  assert.equal(freshForgery.status, 200);
  const forgedCreation = await tusAttempt(freshForgery.data, video, {
    upsert: true,
  });
  if (!forgedCreation)
    assert.ok(
      !(
        await uploadClient.storage
          .from(freshForgery.data.bucket)
          .uploadToSignedUrl(
            freshForgery.data.path,
            freshForgery.data.token,
            video,
            { contentType: "video/mp4" },
          )
      ).error,
    );
  const changedBytes = Buffer.from(video);
  changedBytes[changedBytes.length - 1] ^= 1;
  assert.equal(
    await tusAttempt(freshForgery.data, changedBytes, { upsert: true }),
    false,
  );
  const immutable = await admin.storage
    .from(freshForgery.data.bucket)
    .download(freshForgery.data.path);
  assert.ok(!immutable.error);
  assert.ok(Buffer.from(await immutable.data.arrayBuffer()).equals(video));
  let latest = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  const unfinished = {
    ...latest.data.content,
    processVideo: { url: prep.data.url, published: true },
  };
  assert.equal(
    (
      await json(
        "/api/natori/portfolio/content",
        body({ content: unfinished, expectedRevision: latest.data.revision }),
      )
    ).status,
    400,
  );
  const finalized = await json("/api/natori/portfolio/video-upload/finalize", {
    method: "POST",
    headers: { ...manager, "Content-Type": "application/json" },
    body: JSON.stringify({ assetId: prep.data.assetId }),
  });
  assert.equal(finalized.status, 200);
  saved = await json(
    "/api/natori/portfolio/content",
    body({ content: unfinished, expectedRevision: latest.data.revision }),
  );
  assert.equal(saved.status, 200);
  state = saved;
  const videoURL = prep.data.url.replace(
    "/admin/portfolio-assets/",
    "/portfolio/assets/",
  );
  const ranged = await api(videoURL, { headers: { Range: "bytes=0-15" } });
  assert.equal(ranged.status, 206);
  assert.equal((await ranged.arrayBuffer()).byteLength, 16);
  assert.ok(ranged.headers.get("cache-control").includes("no-store"));
  record(
    "signed video upload stays private until verified; published video supports authorized streaming/ranges",
  );
  // A genuinely successful resumable flow establishes endpoint capability;
  // failed forged requests alone cannot establish signed-token confinement.
  const resumedBytes = Buffer.alloc(6 * 1024 * 1024 + 32);
  video.copy(resumedBytes);
  const resumed = await json("/api/natori/portfolio/video-upload", {
    method: "POST",
    headers: { ...manager, "Content-Type": "application/json" },
    body: JSON.stringify({
      sizeBytes: resumedBytes.length,
      contentType: "video/mp4",
    }),
  });
  assert.equal(resumed.status, 200);
  const metadata = Object.entries({
    bucketName: resumed.data.bucket,
    objectName: resumed.data.path,
    contentType: "video/mp4",
    cacheControl: "0",
  })
    .map(([key, value]) => key + " " + Buffer.from(value).toString("base64"))
    .join(",");
  inputCase = "tus_resume_create";
  const createdTus = await fixtureFetch(
    config.api + "/storage/v1/upload/resumable/sign",
    {
      method: "POST",
      headers: {
        "x-signature": resumed.data.token,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(resumedBytes.length),
        "Upload-Metadata": metadata,
      },
    },
  );
  assert.equal(createdTus.status, 201);
  const resumedURL = new URL(createdTus.headers.get("location"), config.api);
  assert.equal(
    resumedURL.origin,
    config.api,
    "External TUS destination refused",
  );
  const chunkHeaders = (offset) => ({
    "x-signature": resumed.data.token,
    "Tus-Resumable": "1.0.0",
    "Upload-Offset": String(offset),
    "Content-Type": "application/offset+octet-stream",
  });
  inputCase = "tus_resume_first_chunk";
  const firstChunk = await fixtureFetch(resumedURL, {
    method: "PATCH",
    headers: chunkHeaders(0),
    body: resumedBytes.subarray(0, 6 * 1024 * 1024),
  });
  assert.equal(firstChunk.status, 204);
  inputCase = "tus_resume_head";
  const headTus = await fixtureFetch(resumedURL, {
    method: "HEAD",
    headers: { "x-signature": resumed.data.token, "Tus-Resumable": "1.0.0" },
  });
  assert.equal(headTus.status, 200);
  assert.equal(Number(headTus.headers.get("upload-offset")), 6 * 1024 * 1024);
  inputCase = "tus_resume_second_chunk";
  const secondChunk = await fixtureFetch(resumedURL, {
    method: "PATCH",
    headers: chunkHeaders(6 * 1024 * 1024),
    body: resumedBytes.subarray(6 * 1024 * 1024),
  });
  assert.equal(secondChunk.status, 204);
  inputCase = "tus_resume_finalize";
  const resumedFinalize = await json(
    "/api/natori/portfolio/video-upload/finalize",
    {
      method: "POST",
      headers: { ...manager, "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: resumed.data.assetId }),
    },
  );
  assert.equal(resumedFinalize.status, 200);
  inputCase = null;
  // Confinement requires this same signed endpoint's positive capability proof.
  record(
    "anonymous signed bearer is exact-path and exact-bucket scoped and cannot overwrite through normal or forged/TUS upsert",
  );
  record(
    "real anonymous signed TUS upload resumes across chunks and finalizes private media",
  );
  const suffix = await api(videoURL, { headers: { Range: "bytes=-16" } });
  assert.equal(suffix.status, 206);
  assert.equal((await suffix.arrayBuffer()).byteLength, 16);
  const invalidRange = await api(videoURL, {
    headers: { Range: "bytes=0-1,8-9" },
  });
  assert.equal(invalidRange.status, 416);
  const beyond = await api(videoURL, { headers: { Range: "bytes=99999999-" } });
  assert.equal(beyond.status, 416);
  assert.equal(beyond.headers.get("content-range"), "bytes */" + video.length);
  const finalize = (assetId, headers = manager) =>
    json("/api/natori/portfolio/video-upload/finalize", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
  assert.equal((await finalize(prep.data.assetId, other)).status, 401);
  const prepare = (sizeBytes) =>
    json("/api/natori/portfolio/video-upload", {
      method: "POST",
      headers: { ...manager, "Content-Type": "application/json" },
      body: JSON.stringify({ sizeBytes, contentType: "video/mp4" }),
    });
  for (const size of [0, -1, 1.5, 50_000_001])
    assert.equal((await prepare(size)).status, 400);
  const mismatch = await prepare(video.length + 1);
  assert.equal(mismatch.status, 200);
  assert.ok(
    !(
      await uploadClient.storage
        .from(mismatch.data.bucket)
        .uploadToSignedUrl(mismatch.data.path, mismatch.data.token, video, {
          contentType: "video/mp4",
        })
    ).error,
  );
  assert.equal((await finalize(mismatch.data.assetId)).status, 400);
  const fake = await prepare(24);
  assert.equal(fake.status, 200);
  assert.ok(
    !(
      await uploadClient.storage
        .from(fake.data.bucket)
        .uploadToSignedUrl(fake.data.path, fake.data.token, Buffer.alloc(24), {
          contentType: "video/mp4",
        })
    ).error,
  );
  assert.equal((await finalize(fake.data.assetId)).status, 400);
  assert.equal((await api(fake.data.url, { headers: manager })).status, 404);
  const wrongMime = await prepare(
    readFileSync(resultPath("image.webp")).length,
  );
  assert.equal(wrongMime.status, 200);
  assert.ok(
    !(
      await uploadClient.storage
        .from(wrongMime.data.bucket)
        .uploadToSignedUrl(
          wrongMime.data.path,
          wrongMime.data.token,
          readFileSync(resultPath("image.webp")),
          { contentType: "image/webp" },
        )
    ).error,
  );
  assert.equal((await finalize(wrongMime.data.assetId)).status, 400);
  const maximum = await prepare(50_000_000);
  assert.equal(maximum.status, 200);
  const large = Buffer.alloc(50_000_000);
  video.copy(large);
  assert.ok(
    !(
      await uploadClient.storage
        .from(maximum.data.bucket)
        .uploadToSignedUrl(maximum.data.path, maximum.data.token, large, {
          contentType: "video/mp4",
        })
    ).error,
  );
  assert.equal((await finalize(maximum.data.assetId)).status, 200);
  const rejected = await prepare(24);
  assert.equal(rejected.status, 200);
  const oversized = await uploadClient.storage
    .from(rejected.data.bucket)
    .uploadToSignedUrl(
      rejected.data.path,
      rejected.data.token,
      Buffer.alloc(50_000_001),
      { contentType: "video/mp4" },
    );
  assert.ok(oversized.error);
  latest = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  latest.data.content.processVideo = { url: maximum.data.url, published: true };
  state = await json(
    "/api/natori/portfolio/content",
    body({
      content: latest.data.content,
      expectedRevision: latest.data.revision,
    }),
  );
  assert.equal(state.status, 200);
  const streamed = await api(
    maximum.data.url.replace("/admin/portfolio-assets/", "/portfolio/assets/"),
  );
  assert.equal(streamed.status, 200);
  const digest = createHash("sha256");
  let streamedBytes = 0;
  for await (const chunk of streamed.body) {
    streamedBytes += chunk.length;
    digest.update(chunk);
  }
  assert.equal(streamedBytes, 50_000_000);
  assert.equal(
    digest.digest("hex"),
    createHash("sha256").update(large).digest("hex"),
  );
  latest = await json("/api/natori/admin/portfolio-content", {
    headers: manager,
  });
  latest.data.content.processVideo.published = false;
  state = await json(
    "/api/natori/portfolio/content",
    body({
      content: latest.data.content,
      expectedRevision: latest.data.revision,
    }),
  );
  assert.equal(state.status, 200);
  assert.equal(
    (
      await api(
        maximum.data.url.replace(
          "/admin/portfolio-assets/",
          "/portfolio/assets/",
        ),
      )
    ).status,
    404,
  );
  const postFinalizeReplay = await uploadClient.storage
    .from(maximum.data.bucket)
    .uploadToSignedUrl(maximum.data.path, maximum.data.token, video, {
      contentType: "video/mp4",
      upsert: true,
    });
  assert.ok(postFinalizeReplay.error);
  record(
    "real 50 MB video verifies and streams without response buffering; metadata/header/size failures and unpublished URLs denied",
  );

  execFileSync("docker", [
    "exec",
    config.container,
    "psql",
    "-X",
    "-q",
    "-U",
    "postgres",
    "-c",
    "DROP FUNCTION public.natori_save_portfolio_content(bigint,jsonb); NOTIFY pgrst,'reload schema';",
  ]);
  await new Promise((r) => setTimeout(r, 500));
  const before = await admin
    .from("natori_portfolio_content")
    .select("content,revision")
    .eq("id", "main")
    .single();
  assert.equal(
    (
      await json(
        "/api/natori/portfolio/content",
        body({
          content: { ...before.data.content, artistName: "FAILED_SAVE_CANARY" },
          expectedRevision: before.data.revision,
        }),
      )
    ).status,
    500,
  );
  const after = await admin
    .from("natori_portfolio_content")
    .select("content,revision")
    .eq("id", "main")
    .single();
  assert.deepEqual(before.data, after.data);
  record(
    "real save RPC failure leaves content and publication state unchanged",
  );
} catch (error) {
  // Diagnostics expose bounded enums and numeric statuses, never assertion
  // strings, cookies, URLs/query values, token-bearing requests or private logs.
  failure = {
    category: error.name,
    inputCase,
    applicationRequest: requestDiagnostic,
    fixtureRequest: fixtureDiagnostic,
    actualNumeric:
      typeof error.actual === "number" && Number.isFinite(error.actual)
        ? error.actual
        : null,
    expectedNumeric:
      typeof error.expected === "number" && Number.isFinite(error.expected)
        ? error.expected
        : null,
    location: error.stack?.match(/(?:http|local-redirect)\.mjs:\d+:\d+/)?.[0] ?? "unknown",
  };
  throw error;
} finally {
  writeFileSync(
    resultPath("results.json"),
    JSON.stringify(
      {
        syntheticOnly: true,
        failure,
        completed:
          results.at(-1)?.name ===
          "real save RPC failure leaves content and publication state unchanged",
        engine:
          "GoTrue/PostgREST/PostgreSQL/StorageAPI and real Next HTTP; origin-only, no CDN/production claim",
        results,
        legacyURLs: "remain until separate reviewed migration/retirement",
        count: results.length,
      },
      null,
      2,
    ),
  );
}
