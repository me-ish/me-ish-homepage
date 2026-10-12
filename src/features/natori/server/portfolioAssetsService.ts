import "server-only";
import {randomUUID} from "node:crypto";
import {supabaseAdmin} from "@/lib/supabaseAdmin";
import {resolveNatoriOwnerId} from "./natoriOwner";
import {resolveTrustedNatoriOwnerId} from "./trustedNatoriOwner";
import {NATORI_MANAGEMENT_ASSET_BUCKET,parsePortfolioAssetUrl,portfolioAssetUrl} from "../lib/portfolioAssetUrl";
import {projectPortfolioPublicContent} from "../lib/portfolioPublicContent";
import {readPortfolioSavedState} from "./portfolioContentStore";
import type {PortfolioContent} from "../types/portfolio";

type Kind="image"|"video";
const TABLE="natori_portfolio_assets";
const bucket=()=>supabaseAdmin().storage.from(NATORI_MANAGEMENT_ASSET_BUCKET);
const pathFor=(ownerId:string,id:string,kind:Kind)=>`portfolio/${ownerId}/${id}.${kind==="image" ? "webp" : "mp4"}`;

export function portfolioContentAssetReferences(content:PortfolioContent):{url:string;kind:Kind}[] {
  return [
    ...[content.heroImage,...(content.heroImages??[]),content.aboutImage,
      ...content.works.map(work=>work.image),...(content.massProductionSamples??[]).map(sample=>sample.image)]
      .flatMap(url=>url ? [{url,kind:"image" as const}] : []),
    ...(content.processVideo?.url ? [{url:content.processVideo.url,kind:"video" as const}] : []),
  ];
}

export function normalizePortfolioAssetReferences(content:PortfolioContent):PortfolioContent {
  const canonical=(url:string|null)=>{
    const asset=url ? parsePortfolioAssetUrl(url) : null;
    return asset ? portfolioAssetUrl(asset.id,asset.kind,true) : url;
  };
  return {...content,heroImage:canonical(content.heroImage),heroImages:content.heroImages?.map(url=>canonical(url)!),
    aboutImage:canonical(content.aboutImage),works:content.works.map(work=>({...work,image:canonical(work.image)})),
    massProductionSamples:content.massProductionSamples?.map(sample=>({...sample,image:canonical(sample.image)})),
    processVideo:content.processVideo ? {...content.processVideo,url:canonical(content.processVideo.url)??""} : undefined};
}

/** No references to another owner's or unfinished uploads can be committed. */
export async function validatePortfolioAssetReferences(content:PortfolioContent,ownerId:string):Promise<boolean> {
  const refs=portfolioContentAssetReferences(content).flatMap(ref=>{
    const asset=parsePortfolioAssetUrl(ref.url);return asset ? [{...asset,expectedKind:ref.kind}] : [];
  });
  if (refs.some(ref=>ref.kind!==ref.expectedKind)) return false;
  if (!refs.length) return true;
  const ids=[...new Set(refs.map(ref=>ref.id))];
  const {data,error}=await supabaseAdmin().from(TABLE).select("id,kind,path")
    .eq("owner_id",ownerId).eq("ready",true).in("id",ids);
  if (error) throw new Error("Portfolio assets unavailable");
  return ids.every(id=>{
    const row=data?.find(asset=>asset.id===id),kind=refs.find(ref=>ref.id===id)?.kind;
    return row && kind && row.kind===kind && row.path===pathFor(ownerId,id,kind);
  });
}

export async function storePrivatePortfolioImage(webp:Buffer):Promise<string|null> {
  const ownerId=await resolveNatoriOwnerId(),id=randomUUID(),path=pathFor(ownerId,id,"image");
  const uploaded=await bucket().upload(path,webp,{contentType:"image/webp",cacheControl:"0",upsert:false});
  if (uploaded.error) return null;
  const {error}=await supabaseAdmin().from(TABLE).insert({id,owner_id:ownerId,kind:"image",path,byte_size:webp.length,ready:true});
  if (error) {
    await bucket().remove([path]); // Only this newly generated private object, never a legacy URL.
    return null;
  }
  return portfolioAssetUrl(id,"image",true);
}

export async function preparePrivatePortfolioVideo(sizeBytes:number):Promise<{id:string;path:string;token:string;url:string}|null> {
  const ownerId=await resolveNatoriOwnerId(),id=randomUUID(),path=pathFor(ownerId,id,"video");
  const signed=await bucket().createSignedUploadUrl(path,{upsert:false});
  if (signed.error || !signed.data) return null;
  const {error}=await supabaseAdmin().from(TABLE).insert({id,owner_id:ownerId,kind:"video",path,byte_size:sizeBytes,ready:false});
  if (error) return null;
  return {id,path,token:signed.data.token,url:portfolioAssetUrl(id,"video",true)};
}

export async function finalizePrivatePortfolioVideo(id:string):Promise<boolean> {
  const ownerId=await resolveNatoriOwnerId();
  const {data,error}=await supabaseAdmin().from(TABLE).select("path,byte_size,ready")
    .eq("id",id).eq("owner_id",ownerId).eq("kind","video").maybeSingle();
  if (error || !data || data.path!==pathFor(ownerId,id,"video")) return false;
  const downloaded=await bucket().download(data.path);
  if (downloaded.error || !downloaded.data || downloaded.data.size!==data.byte_size) return false;
  const header=new Uint8Array(await downloaded.data.slice(0,24).arrayBuffer());
  if (header.length<16 || String.fromCharCode(...header.slice(4,8))!=="ftyp") return false;
  const updated=await supabaseAdmin().from(TABLE).update({ready:true})
    .eq("id",id).eq("owner_id",ownerId).select("id").maybeSingle();
  return !updated.error && Boolean(updated.data);
}

function isPublished(content:PortfolioContent,id:string,kind:Kind):boolean {
  return portfolioContentAssetReferences(projectPortfolioPublicContent(content)).some(ref=>{
    const asset=parsePortfolioAssetUrl(ref.url);return asset?.id===id && asset.kind===kind && ref.kind===kind;
  });
}

/** Public requests recheck saved publication after download; drafts never use a public bucket. */
export async function readPortfolioAsset(request:Request,id:string,kind:Kind,management:boolean):Promise<Response|null> {
  const owner=resolveTrustedNatoriOwnerId();
  if (owner.kind!=="ok") throw new Error("Portfolio owner unavailable");
  const ownerId=management ? await resolveNatoriOwnerId() : owner.ownerId;
  if (!management && !isPublished((await readPortfolioSavedState()).content,id,kind)) return null;
  const {data,error}=await supabaseAdmin().from(TABLE).select("path,ready,byte_size")
    .eq("id",id).eq("kind",kind).eq("owner_id",ownerId).maybeSingle();
  if (error) throw new Error("Portfolio asset unavailable");
  if (!data || data.path!==pathFor(ownerId,id,kind) || (!management && !data.ready)) return null;
  const range=request.headers.get("range");
  if (range && (range.length>96 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) return new Response(null,{status:416,headers:{"Cache-Control":"no-store"}});
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Portfolio storage configuration unavailable");
  const url=new URL(`${base.replace(/\/$/,"")}/storage/v1/object/authenticated/${NATORI_MANAGEMENT_ASSET_BUCKET}/${data.path.split("/").map(encodeURIComponent).join("/")}`);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error("Portfolio storage configuration invalid");
  const downloaded=await fetch(url,{headers:{apikey:key,Authorization:`Bearer ${key}`,...(range ? {Range:range} : {})},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(300000)});
  if (downloaded.status===404) {await downloaded.body?.cancel();return null;}
  if (downloaded.status===416) {await downloaded.body?.cancel();return new Response(null,{status:416,headers:{"Cache-Control":"no-store","Content-Range":`bytes */${data.byte_size}`}});}
  if (!downloaded.ok || !downloaded.body) {await downloaded.body?.cancel();throw new Error("Portfolio asset download unavailable");}
  if (!management && !isPublished((await readPortfolioSavedState()).content,id,kind)) {await downloaded.body.cancel();return null;}
  const headers=new Headers({"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff","Accept-Ranges":"bytes","Content-Type":kind==="image" ? "image/webp" : "video/mp4"});
  if (downloaded.status===206) {
    const contentRange=downloaded.headers.get("content-range");
    if (!contentRange || !/^bytes \d+-\d+\/\d+$/.test(contentRange)) {await downloaded.body.cancel();throw new Error("Portfolio asset range invalid");}
    headers.set("Content-Range",contentRange);
  }
  // Keep the upstream body streaming; never buffer a 50MB video in a Function.
  return new Response(downloaded.body,{status:downloaded.status,headers});
}
