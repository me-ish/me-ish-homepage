"use client";
import {useState} from "react";
import {ImageOff} from "lucide-react";
import type {NatoriProjectReferenceFileView} from "@/features/natori/types/projects";
export default function InquiryReferenceFiles({files,expectedCount,acquisitionState}:{files:NatoriProjectReferenceFileView[];expectedCount?:number;acquisitionState?:"ready"|"unavailable"}){
 const [broken,setBroken]=useState<Record<string,boolean>>({}),total=expectedCount??files.length;
 if(total===0&&acquisitionState!=="unavailable")return null;
 return<section aria-labelledby="inquiry-files-heading"><h3 id="inquiry-files-heading" className="mb-2 text-xs font-bold uppercase tracking-wide text-pink-700">参考画像{total?"（"+total+"件）":""}</h3>
  {acquisitionState==="unavailable"?<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">資料一覧の取得に失敗しました。提出状況は、画面を再読み込みして確認してください。</p>:null}
  <ul className="flex flex-wrap gap-2">{files.map((file,index)=><li key={file.name+"-"+index} className="w-24">
   {file.url?<a href={file.url} target="_blank" rel="noopener noreferrer" title="クリックで原寸表示" className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400">
    {broken[file.url]?<span className="grid h-24 w-24 place-items-center rounded-lg border border-pink-200 bg-gray-50 text-gray-400"><ImageOff className="h-5 w-5" aria-hidden/><span className="sr-only">画像を読み込めませんでした</span></span>:
     // Private short-lived signed image URL is loaded directly; no proxy/caching by next/image.
     // eslint-disable-next-line @next/next/no-img-element
     <img src={file.url} alt={file.name} onError={()=>setBroken(current=>({...current,[file.url!]:true}))} className="h-24 w-24 rounded-lg border border-pink-200 object-cover transition hover:opacity-80"/>}
   </a>:<p role="status" className="rounded border border-amber-200 p-2 text-xs text-amber-900">提出済みの資料です。リンクを取得できません。再読み込みしてください。</p>}
   <p className="mt-1 truncate text-[11px] text-gray-600" title={file.name}>{file.name}</p>
  </li>)}</ul>
  {total>files.length?<p role="status" className="mt-2 text-xs text-amber-900">一部の提出済み資料を表示できません。再読み込みしてください。</p>:null}
 </section>;
}
