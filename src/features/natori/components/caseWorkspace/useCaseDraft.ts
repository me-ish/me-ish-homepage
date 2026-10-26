"use client";
import {useEffect,useRef,useState,type Dispatch,type SetStateAction} from "react";
/** Tab-local draft only. No credentials/capability URLs/files; no server fact is inferred. */
export function useCaseDraft<T extends Record<string,string>>(key:string,initial:T,onDirty:(dirty:boolean)=>void):[T,Dispatch<SetStateAction<T>>,(next:T)=>void]{
 const baseline=useRef(initial);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [value,setValue]=useState<T>(()=>{
  if(typeof window==="undefined")return initial;
  try{const raw=sessionStorage.getItem(key);if(!raw)return initial;const saved:unknown=JSON.parse(raw);
   if(!saved||typeof saved!=="object"||Array.isArray(saved))return initial;
   const candidate=saved as Record<string,unknown>;
   if(Object.keys(initial).some(k=>typeof candidate[k]!=="string"||(candidate[k] as string).length>20000))return initial;
   return Object.fromEntries(Object.keys(initial).map(k=>[k,candidate[k]])) as T;
  }catch{return initial;}
 });
 const dirty=JSON.stringify(value)!==JSON.stringify(baseline.current);
 useEffect(()=>{onDirty(dirty);try{if(dirty)sessionStorage.setItem(key,JSON.stringify(value));else sessionStorage.removeItem(key);}catch{/* Visible draft and leaving guard remain. */}},[dirty,key,value,onDirty]);
 useEffect(()=>()=>onDirty(false),[onDirty]);
 return[value,setValue,next=>{if(!mounted.current)return;baseline.current=next;setValue(next);sessionStorage.removeItem(key);}];
}
