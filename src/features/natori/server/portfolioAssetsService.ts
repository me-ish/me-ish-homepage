import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveNatoriOwnerId } from "./natoriOwner";
import { resolveTrustedNatoriOwnerId } from "./trustedNatoriOwner";
import {
  NATORI_MANAGEMENT_ASSET_BUCKET,
  parsePortfolioAssetUrl,
  isNonLocalPortfolioAssetUrl,
  portfolioAssetUrl,
} from "../lib/portfolioAssetUrl";
import { projectPortfolioPublicContent } from "../lib/portfolioPublicContent";
import { readPortfolioSavedState } from "./portfolioContentStore";
import type { PortfolioContent } from "../types/portfolio";

type Kind = "image" | "video";
const TABLE = "natori_portfolio_assets";
const bucket = () =>
  supabaseAdmin().storage.from(NATORI_MANAGEMENT_ASSET_BUCKET);
const pathFor = (ownerId: string, id: string, kind: Kind) =>
  `portfolio/${ownerId}/${id}.${kind === "image" ? "webp" : "mp4"}`;
const videoStagingPath = (ownerId: string, id: string) =>
  `portfolio-staging/${ownerId}/${id}.mp4`;
const finalVideoPrefix = (ownerId: string, id: string) =>
  `portfolio/${ownerId}/${id}/`;
const isReadyPath = (path: string, ownerId: string, id: string, kind: Kind) =>
  kind === "image"
    ? path === pathFor(ownerId, id, kind)
    : path.startsWith(finalVideoPrefix(ownerId, id)) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/.test(
        path.slice(finalVideoPrefix(ownerId, id).length),
      );

export function portfolioContentAssetReferences(
  content: PortfolioContent,
): { url: string; kind: Kind }[] {
  return [
    ...[
      content.heroImage,
      ...(content.heroImages ?? []),
      content.aboutImage,
      ...content.works.map((work) => work.image),
      ...(content.massProductionSamples ?? []).map((sample) => sample.image),
    ].flatMap((url) => (url ? [{ url, kind: "image" as const }] : [])),
    ...(content.processVideo?.url
      ? [{ url: content.processVideo.url, kind: "video" as const }]
      : []),
  ];
}

export function normalizePortfolioAssetReferences(
  content: PortfolioContent,
): PortfolioContent {
  const canonical = (url: string | null) => {
    const asset = url ? parsePortfolioAssetUrl(url) : null;
    return asset ? portfolioAssetUrl(asset.id, asset.kind, true) : url;
  };
  return {
    ...content,
    heroImage: canonical(content.heroImage),
    heroImages: content.heroImages?.map((url) => canonical(url)!),
    aboutImage: canonical(content.aboutImage),
    works: content.works.map((work) => ({
      ...work,
      image: canonical(work.image),
    })),
    massProductionSamples: content.massProductionSamples?.map((sample) => ({
      ...sample,
      image: canonical(sample.image),
    })),
    processVideo: content.processVideo
      ? {
          ...content.processVideo,
          url: canonical(content.processVideo.url) ?? "",
        }
      : undefined,
  };
}

/** No references to another owner's or unfinished uploads can be committed. */
export async function validatePortfolioAssetReferences(
  content: PortfolioContent,
  ownerId: string,
): Promise<boolean> {
  const references = portfolioContentAssetReferences(content);
  if (references.some((ref) => isNonLocalPortfolioAssetUrl(ref.url)))
    return false;
  const refs = references.flatMap((ref) => {
    const asset = parsePortfolioAssetUrl(ref.url);
    return asset ? [{ ...asset, expectedKind: ref.kind }] : [];
  });
  if (refs.some((ref) => ref.kind !== ref.expectedKind)) return false;
  if (!refs.length) return true;
  const ids = [...new Set(refs.map((ref) => ref.id))];
  const { data, error } = await supabaseAdmin()
    .from(TABLE)
    .select("id,kind,path")
    .eq("owner_id", ownerId)
    .eq("ready", true)
    .in("id", ids);
  if (error) throw new Error("Portfolio assets unavailable");
  return ids.every((id) => {
    const row = data?.find((asset) => asset.id === id),
      kind = refs.find((ref) => ref.id === id)?.kind;
    return (
      row &&
      kind &&
      row.kind === kind &&
      isReadyPath(row.path, ownerId, id, kind)
    );
  });
}

export async function storePrivatePortfolioImage(
  webp: Buffer,
): Promise<string | null> {
  const ownerId = await resolveNatoriOwnerId(),
    id = randomUUID(),
    path = pathFor(ownerId, id, "image");
  const uploaded = await bucket().upload(path, webp, {
    contentType: "image/webp",
    cacheControl: "0",
    upsert: false,
  });
  if (uploaded.error) return null;
  const { error } = await supabaseAdmin().from(TABLE).insert({
    id,
    owner_id: ownerId,
    kind: "image",
    path,
    byte_size: webp.length,
    ready: true,
  });
  if (error) {
    await bucket().remove([path]); // Only this newly generated private object, never a legacy URL.
    return null;
  }
  return portfolioAssetUrl(id, "image", true);
}

export async function preparePrivatePortfolioVideo(
  sizeBytes: number,
): Promise<{ id: string; path: string; token: string; url: string } | null> {
  const ownerId = await resolveNatoriOwnerId(),
    id = randomUUID(),
    path = videoStagingPath(ownerId, id);
  const signed = await bucket().createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data) return null;
  const { error } = await supabaseAdmin().from(TABLE).insert({
    id,
    owner_id: ownerId,
    kind: "video",
    path,
    byte_size: sizeBytes,
    ready: false,
  });
  if (error) return null;
  return {
    id,
    path,
    token: signed.data.token,
    url: portfolioAssetUrl(id, "video", true),
  };
}

function storageDownload(
  path: string,
  range?: string,
  signal?: AbortSignal,
): Promise<Response> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key)
    throw new Error("Portfolio storage configuration unavailable");
  const url = new URL(
    `${base.replace(/\/$/, "")}/storage/v1/object/authenticated/${NATORI_MANAGEMENT_ASSET_BUCKET}/${path.split("/").map(encodeURIComponent).join("/")}`,
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("Portfolio storage configuration invalid");
  }
  return fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(range ? { Range: range } : {}),
    },
    cache: "no-store",
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(300000)])
      : AbortSignal.timeout(300000),
  });
}

/** Verify the copied snapshot, never mutable browser staging or a full video. */
async function verifyVideoSnapshot(
  path: string,
  byteSize: number,
): Promise<boolean> {
  const info = await bucket().info(path);
  if (
    info.error ||
    !info.data ||
    info.data.name !== path ||
    info.data.bucketId !== NATORI_MANAGEMENT_ASSET_BUCKET ||
    info.data.size !== byteSize ||
    info.data.contentType !== "video/mp4"
  )
    return false;
  const downloaded = await storageDownload(path, "bytes=0-23");
  const expectedLength = Math.min(24, byteSize);
  if (
    downloaded.status !== 206 ||
    !downloaded.body ||
    downloaded.headers.get("content-type")?.split(";")[0] !== "video/mp4" ||
    downloaded.headers.get("content-range") !==
      `bytes 0-${expectedLength - 1}/${byteSize}`
  ) {
    await downloaded.body?.cancel();
    return false;
  }
  const reader = downloaded.body.getReader();
  const header = new Uint8Array(expectedLength);
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (length + chunk.value.byteLength > expectedLength) return false;
      header.set(chunk.value, length);
      length += chunk.value.byteLength;
    }
  } finally {
    await reader.cancel();
  }
  const brand = String.fromCharCode(...header.slice(8, 12));
  if (
    length !== expectedLength ||
    length < 16 ||
    String.fromCharCode(...header.slice(4, 8)) !== "ftyp" ||
    !/^(?:isom|iso[2-9]|mp4[12]|avc1|M4V )$/.test(brand)
  )
    return false;
  return true;
}

/** Browser bearer tokens may replay staging; they never name finalized bytes. */
export async function finalizePrivatePortfolioVideo(id: string): Promise<boolean> {
  const ownerId = await resolveNatoriOwnerId();
  const { data, error } = await supabaseAdmin()
    .from(TABLE)
    .select("path,byte_size,ready")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .eq("kind", "video")
    .maybeSingle();
  if (error || !data) return false;
  // A retry cannot refresh or replace a committed snapshot from mutable staging.
  if (data.ready) return isReadyPath(data.path, ownerId, id, "video");
  if (data.path !== videoStagingPath(ownerId, id)) return false;
  const path = finalVideoPrefix(ownerId, id) + randomUUID() + ".mp4";
  const copied = await bucket().copy(data.path, path);
  if (copied.error) return false;
  if (!(await verifyVideoSnapshot(path, data.byte_size))) return false;
  const updated = await supabaseAdmin()
    .from(TABLE)
    .update({ path, ready: true })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .eq("kind", "video")
    .eq("ready", false)
    .eq("path", data.path)
    .eq("byte_size", data.byte_size)
    .select("id")
    .maybeSingle();
  if (!updated.error && updated.data) return true;
  // A concurrent winner or lost response may already have committed. Recheck
  // ownership and the canonical ready snapshot; never retry the copy in place.
  const committed = await supabaseAdmin()
    .from(TABLE)
    .select("path,byte_size,ready")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .eq("kind", "video")
    .maybeSingle();
  // Keep failed/losing copies private. An error can follow a committed update;
  // deleting that candidate could destroy the winner's published bytes. Scoped
  // orphan/staging retention is handled by a separately reviewed cleanup.
  return (
    !committed.error &&
    Boolean(
      committed.data?.ready &&
        committed.data.byte_size === data.byte_size &&
        isReadyPath(committed.data.path, ownerId, id, "video"),
    )
  );
}

function isPublished(
  content: PortfolioContent,
  id: string,
  kind: Kind,
): boolean {
  return portfolioContentAssetReferences(
    projectPortfolioPublicContent(content),
  ).some((ref) => {
    const asset = parsePortfolioAssetUrl(ref.url);
    return asset?.id === id && asset.kind === kind && ref.kind === kind;
  });
}

/** Public requests recheck saved publication after download; drafts never use a public bucket. */
export async function readPortfolioAsset(
  request: Request,
  id: string,
  kind: Kind,
  management: boolean,
): Promise<Response | null> {
  const owner = resolveTrustedNatoriOwnerId();
  if (owner.kind !== "ok") throw new Error("Portfolio owner unavailable");
  const ownerId = management ? await resolveNatoriOwnerId() : owner.ownerId;
  if (
    !management &&
    !isPublished((await readPortfolioSavedState()).content, id, kind)
  )
    return null;
  const { data, error } = await supabaseAdmin()
    .from(TABLE)
    .select("path,ready,byte_size")
    .eq("id", id)
    .eq("kind", kind)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error("Portfolio asset unavailable");
  if (!data || !isReadyPath(data.path, ownerId, id, kind) || !data.ready)
    return null;
  const range = request.headers.get("range");
  if (range && (range.length > 96 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)))
    return new Response(null, {
      status: 416,
      headers: { "Cache-Control": "no-store" },
    });
  const downloaded = await storageDownload(
    data.path,
    range ?? undefined,
    request.signal,
  );
  if (downloaded.status === 404) {
    await downloaded.body?.cancel();
    return null;
  }
  if (downloaded.status === 416) {
    await downloaded.body?.cancel();
    return new Response(null, {
      status: 416,
      headers: {
        "Cache-Control": "no-store",
        "Content-Range": `bytes */${data.byte_size}`,
      },
    });
  }
  if (!downloaded.ok || !downloaded.body) {
    await downloaded.body?.cancel();
    throw new Error("Portfolio asset download unavailable");
  }
  const contentType = kind === "image" ? "image/webp" : "video/mp4";
  if (
    downloaded.headers.get("content-type")?.split(";")[0] !== contentType ||
    ![200, 206].includes(downloaded.status)
  ) {
    await downloaded.body.cancel();
    throw new Error("Portfolio asset metadata invalid");
  }
  if (!management) {
    try {
      if (!isPublished((await readPortfolioSavedState()).content, id, kind)) {
        await downloaded.body.cancel();
        return null;
      }
    } catch (error) {
      await downloaded.body.cancel();
      throw error;
    }
  }
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Type": kind === "image" ? "image/webp" : "video/mp4",
  });
  if (downloaded.status === 206) {
    const contentRange = downloaded.headers.get("content-range");
    const match = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (
      !range ||
      !match ||
      Number(match[3]) !== data.byte_size ||
      Number(match[1]) > Number(match[2]) ||
      Number(match[2]) >= data.byte_size
    ) {
      await downloaded.body.cancel();
      throw new Error("Portfolio asset range invalid");
    }
    const requested = /^bytes=(\d*)-(\d*)$/.exec(range);
    const expectedStart = requested?.[1]
      ? Number(requested[1])
      : Math.max(0, data.byte_size - Number(requested?.[2]));
    const expectedEnd =
      requested?.[1] && requested[2]
        ? Math.min(Number(requested[2]), data.byte_size - 1)
        : data.byte_size - 1;
    if (
      Number(match[1]) !== expectedStart ||
      Number(match[2]) !== expectedEnd
    ) {
      await downloaded.body.cancel();
      throw new Error("Portfolio asset range invalid");
    }
    headers.set(
      "Content-Length",
      String(Number(match[2]) - Number(match[1]) + 1),
    );
    headers.set("Content-Range", contentRange!);
  }
  if (downloaded.status === 200) {
    if (downloaded.headers.get("content-length") !== String(data.byte_size)) {
      await downloaded.body.cancel();
      throw new Error("Portfolio asset size invalid");
    }
    headers.set("Content-Length", String(data.byte_size));
  }
  // Keep the upstream body streaming; never buffer a 50MB video in a Function.
  return new Response(downloaded.body, { status: downloaded.status, headers });
}
