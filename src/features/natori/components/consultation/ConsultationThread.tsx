"use client";

import { natoriPrimaryActionClassName } from "@/features/natori/constants/natoriPrimaryAction";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { natoriClientUi } from "@/features/natori/constants/clientUi";
import { useCallback, useEffect, useRef, useState } from "react";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { ArrowDown, MessageCircle, Paperclip, RefreshCw, Send } from "lucide-react";
import { consultationOperationSchema, freezeConsultationOperation, consultationDigest, type ConsultationOperation } from "@/features/natori/lib/consultationOperation";
import { validConsultationFile } from "@/features/natori/lib/consultationFileRules";
import { consultationUploadEndpoint } from "@/features/natori/lib/consultationUploadEndpoint";
import type { ConsultationMessage, StaffRoughOk } from "@/features/natori/types/consultation";
import { roughSignature } from "@/features/natori/lib/roughSignature";
import { roughOkSignature, staffRoughOkListSchema } from "@/features/natori/lib/roughFollowup";
import RoughOkFollowups from "./RoughOkFollowups";

type Props =
  | { mode: "staff"; readOnlyLookup?: boolean; workspaceExpected?:{title:string;clientName:string;email:string|null}; projectId: string; clientEmail?: string; standalone?: boolean; initialMessages?: never; token?: never; closed?: boolean; onChanged?: () => void; onDraftChange?: (hasDraft: boolean) => void }
  | { mode: "client"; token: string; initialMessages: ConsultationMessage[]; closed: boolean; projectId?: never; clientEmail?: never };

type ComposerJob = { actor: string; generation: number };
type Probe = { count: number; lastId: string | null; closed: boolean; roughs?: string; roughOks?: string | null };

/** How often an open, visible thread asks whether anything changed. */
const POLL_MS = 15000;
/** Within this many px of the viewport bottom counts as "reading the latest". */
const FOLLOW_SLACK_PX = 120;

// Client mode follows the public look (natoriClientUi); staff mode keeps the
// admin neutrals. Both read as a chat: your own messages on the right.
const threadTone = {
  client: {
    section: "rounded-3xl border border-[#F2D9E0] bg-white shadow-[0_10px_22px_rgba(0,0,0,0.06)]",
    pad: "px-4 sm:px-6",
    rule: "border-[#F6E3E9]",
    title: "text-[16px] font-bold leading-6 text-[#242027]",
    titleIcon: "text-[#EC4899]",
    caption: "text-[13px] leading-6 text-[#6B6470]",
    meta: "text-[12px] font-bold leading-5 text-[#6B6470]",
    body: "text-[15px] leading-7 text-[#242027]",
    own: "rounded-2xl rounded-br-md bg-[#FFF0F6]",
    other: "rounded-2xl rounded-bl-md border border-[#F2D9E0] bg-white",
    file: "border-[#F2D9E0] bg-white text-[#BE185D] hover:bg-[#FFF8FA]",
    warning: "text-[13px] font-bold leading-6 text-[#8A4800]",
    label: "text-[13px] font-bold leading-6 text-[#242027]",
    textarea: "w-full rounded-2xl border border-[#878287] bg-white p-3 text-[16px] leading-7 text-[#242027] transition-colors placeholder:text-[#6B6470] focus:border-[#BE185D] focus:outline-none focus:ring-4 focus:ring-[#BE185D]/15 disabled:bg-[#F6F4F5]",
    draft: "rounded-xl border border-[#F2D9E0] bg-[#FFF8FA] text-[13px] leading-5",
    textButton: `text-[13px] font-bold text-[#BE185D] underline underline-offset-4 ${natoriClientUi.focus}`,
    retry: `text-[13px] font-bold text-[#8A4800] underline underline-offset-4 ${natoriClientUi.focus}`,
    secondary: natoriClientUi.btnSecondary,
    primary: `${natoriPrimaryActionClassName} inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold leading-snug`,
    alertError: natoriClientUi.alertError,
    alertSuccess: "rounded-2xl border border-[#BCE8DA] bg-[#E8FFF8] px-4 py-3 text-[14px] font-bold leading-6 text-[#00664F]",
  },
  staff: {
    section: `rounded-2xl ${natoriAdminUi.surface}`,
    pad: "px-3 sm:px-4",
    rule: "border-zinc-100",
    title: "text-sm font-semibold leading-6 text-zinc-900",
    titleIcon: "text-[#DB2777]",
    caption: "text-xs leading-5 text-zinc-600",
    meta: "text-xs font-semibold leading-5 text-zinc-600",
    body: "text-sm leading-6 text-zinc-900",
    own: "rounded-2xl rounded-br-md bg-pink-50 ring-1 ring-inset ring-pink-500/10",
    other: "rounded-2xl rounded-bl-md bg-zinc-50 ring-1 ring-inset ring-zinc-200",
    file: "border-zinc-200 bg-white text-[#BE185D] hover:bg-zinc-50",
    warning: "text-xs font-semibold leading-5 text-amber-800",
    label: "text-xs font-semibold leading-5 text-zinc-700",
    textarea: natoriAdminUi.input,
    draft: "rounded-xl border border-zinc-200 bg-zinc-50 text-xs leading-5",
    textButton: `text-xs font-semibold text-[#BE185D] underline underline-offset-4 ${natoriAdminUi.focusRing}`,
    retry: `text-xs font-semibold text-amber-800 underline underline-offset-4 ${natoriAdminUi.focusRing}`,
    secondary: natoriAdminUi.btnSecondary,
    primary: natoriAdminUi.btnPrimary,
    alertError: natoriAdminUi.alert.error,
    alertSuccess: natoriAdminUi.alert.success,
  },
} as const;

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));
}

function roughNote(rough: NonNullable<ConsultationMessage["rough"]>, mode: "staff" | "client"): string {
  const name = rough.beforeQuote ? (mode === "client" ? "参考ラフ（見積もり前）" : "参考ラフ") : "ラフ";
  if (rough.okAt) return `${name} · ${mode === "client" ? "OKをお伝えしました" : "依頼者がOK"} ${dateTime(rough.okAt)}`;
  return `${name} · ${mode === "client" ? "上のカードから「このラフでOK」を送れます" : "依頼者のOK待ち"}`;
}

function renderText(value: string) {
  return value.split(/(https:\/\/[^\s]+)/g).map((part, index) => {
    if (part.startsWith("https://")) {
      try {
        const parsed = new URL(part);
        if (parsed.protocol === "https:") return <a key={index} href={parsed.href} target="_blank" rel="noopener noreferrer" className="break-all text-pink-700 underline">{part}</a>;
      } catch { /* Leave malformed URLs as plain text. */ }
    }
    return <span key={index}>{part}</span>;
  });
}

export default function ConsultationThread(props: Props) {
  const endpoint = props.mode === "staff"
    ? `/api/natori/admin/consultation?projectId=${encodeURIComponent(props.projectId)}`
    : `/api/natori/consult/${encodeURIComponent(props.token)}`;
  const postEndpoint = props.mode === "staff" ? "/api/natori/admin/consultation" : endpoint;
  const actorKey = props.mode + "/" + (props.mode === "staff" ? props.projectId : props.token);
  const currentActor = useRef(actorKey);
  currentActor.current = actorKey;
  const mounted = useRef(false);
  const operationGeneration = useRef(0);
  const currentPending = useRef<ConsultationOperation | null>(null);
  const busyOwner = useRef<ComposerJob | null>(null);
  const ownsActor = () => mounted.current && currentActor.current === actorKey;
  const ownsAttempt = (job: ComposerJob) => ownsActor() && job.actor === actorKey && operationGeneration.current === job.generation;
  const ownsPending = (operation: ConsultationOperation, job: ComposerJob) => ownsAttempt(job)
    && currentPending.current?.operationId === operation.operationId && currentPending.current.requestHash === operation.requestHash;
  const ownsBusy = (job: ComposerJob) => ownsActor() && job.actor === actorKey && busyOwner.current === job;
  const [messages, setMessages] = useState<ConsultationMessage[]>(props.mode === "client" ? props.initialMessages : []);
  const [roughOks, setRoughOks] = useState<StaffRoughOk[] | null>(null);
  const roughOksRef = useRef(roughOks);
  roughOksRef.current = roughOks;
  const [roughOkSendingEnabled, setRoughOkSendingEnabled] = useState(false);
  const [roughOkActionsAllowed, setRoughOkActionsAllowed] = useState(false);
  const [body, setBody] = useState("");
  const [review,setReview]=useState(false);
  const reviewGuard=useRef<unknown>();
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(props.mode === "staff");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [closed, setClosed] = useState(props.closed ?? false);
  const closedRef = useRef(closed);
  closedRef.current = closed;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const lastMessageRef = useRef<HTMLLIElement>(null);
  const knownMessages = useRef(new Set(messages.map(message => message.id)));
  const historyLoaded = useRef(props.mode === "client");
  const requestVersion = useRef({ value: 0 });
  const lastRefresh = useRef(0);
  const followAfterRender = useRef(false);
  const polling = useRef(false);
  const changed = props.mode === "staff" ? props.onChanged : undefined;
  const onDraftChange = props.mode === "staff" ? props.onDraftChange : undefined;
  const workspaceLookup=props.mode==="staff"&&props.readOnlyLookup;
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const reload = useCallback(async (afterSaved = false, follow = false) => {
    if (!mounted.current || currentActor.current !== actorKey) return false;
    const version = ++requestVersion.current.value;
    const ownsRead = () => mounted.current && currentActor.current === actorKey && version === requestVersion.current.value;
    lastRefresh.current = Date.now();
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!ownsRead()) return false;
      if (!response.ok) throw new Error("相談履歴を読み込めませんでした。リンクが有効か確認して、もう一度更新してください。");
      const data = await response.json() as { messages: ConsultationMessage[]; closed?: boolean; roughOks?: unknown; roughOkSendingEnabled?: unknown; roughOkActionsAllowed?: unknown };
      if (!ownsRead()) return false;
      if (!Array.isArray(data.messages)) throw new Error("相談履歴を読み込めませんでした");
      const arrived = historyLoaded.current && data.messages.some(message => !knownMessages.current.has(message.id));
      if (arrived && follow) { followAfterRender.current = true; setNewMessages(false); }
      else if (arrived) setNewMessages(true);
      historyLoaded.current = true;
      knownMessages.current = new Set(data.messages.map(message => message.id));
      setMessages(data.messages);
      if (props.mode === "staff") {
        const parsed = staffRoughOkListSchema.safeParse(data.roughOks);
        setRoughOks(parsed.success ? parsed.data : null);
        setRoughOkSendingEnabled(data.roughOkSendingEnabled === true);
        setRoughOkActionsAllowed(parsed.success && data.roughOkActionsAllowed === true);
      }
      if (typeof data.closed === "boolean") setClosed(data.closed);
      setHistoryUnavailable(false);
      setError("");
      return true;
    } catch (error) {
      if (!ownsRead()) return false;
      setHistoryUnavailable(true);
      setRoughOkActionsAllowed(false);
      setError(afterSaved ? "送信は保存済みですが、履歴を更新できませんでした。「履歴を更新」で確認してください。本文を送り直す必要はありません。" : error instanceof Error ? error.message : "相談履歴を読み込めませんでした");
      return false;
    } finally {
      if (ownsRead()) setLoading(false);
    }
  }, [endpoint, actorKey, props.mode]);

  const refresh = useCallback(() => reload(), [reload]);
  const probeEndpoint = endpoint + (props.mode === "staff" ? "&probe=1" : "?probe=1");

  useEffect(() => {
    const requests = requestVersion.current;
    const generations = operationGeneration;
    mounted.current = true;
    void refresh();
    const resume = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > 1000) void refresh();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      mounted.current = false;
      generations.current++;
      currentPending.current = null;
      busyOwner.current = null;
      requests.value++;
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [refresh]);


  // Open, visible threads ask a cheap "what changed" endpoint and reload only on a
  // difference. Failures here stay silent: the manual button and the focus refresh
  // remain the places where a load problem is shown.
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible" || polling.current) return;
      if (busyOwner.current || currentPending.current || !historyLoaded.current) return;
      polling.current = true;
      try {
        const response = await fetch(probeEndpoint, { cache: "no-store" });
        if (!response.ok || !mounted.current || currentActor.current !== actorKey || busyOwner.current || currentPending.current) return;
        const probe = await response.json() as Partial<Probe>;
        const last = lastMessageRef.current;
        const known = knownMessages.current;
        const different = typeof probe.count === "number" && (probe.count !== known.size || (probe.lastId !== null && probe.lastId !== undefined && !known.has(probe.lastId)));
        const closedChanged = typeof probe.closed === "boolean" && probe.closed !== closedRef.current;
        const roughsChanged = typeof probe.roughs === "string" && probe.roughs !== roughSignature(messagesRef.current.flatMap(message => message.rough ? [{ id: message.rough.id, answered: Boolean(message.rough.okAt) }] : []));
        const roughOksChanged = props.mode === "staff" && (probe.roughOks === null || (typeof probe.roughOks === "string" && probe.roughOks !== (roughOksRef.current === null ? null : roughOkSignature(roughOksRef.current))));
        if (!different && !closedChanged && !roughsChanged && !roughOksChanged) return;
        const nearBottom = !last || last.getBoundingClientRect().bottom <= window.innerHeight + FOLLOW_SLACK_PX;
        if (await reload(false, nearBottom) && roughOksChanged) changed?.();
      } catch { /* Silent: the next tick or a manual refresh retries. */ } finally {
        polling.current = false;
      }
    };
    const timer = window.setInterval(() => void tick(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [probeEndpoint, actorKey, reload, props.mode, changed]);

  useEffect(() => {
    if (!followAfterRender.current) return;
    followAfterRender.current = false;
    lastMessageRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  const showLatest = () => {
    lastMessageRef.current?.scrollIntoView({ block: "nearest" });
    lastMessageRef.current?.focus({ preventScroll: true });
    setNewMessages(false);
  };

  const refreshAfterSend = async () => {
    if (!ownsActor()) return;
    changed?.();
    await reload(true);
  };

  const cacheKey="natori-consultation-operation/"+(props.mode==="staff"?props.projectId:props.token);
  const actor=props.mode==="staff"?{projectId:props.projectId}:{token:props.token};
  const [draftFiles,setDraftFiles]=useState<{id:string;file:File}[]>([]);
  const hasDraft = body.trim() !== "" || draftFiles.length > 0;
  useEffect(() => { onDraftChange?.(hasDraft); }, [hasDraft, onDraftChange]);
  const [pending,setPending]=useState<ConsultationOperation|null>(null);
  const [cacheReady,setCacheReady]=useState(false);
  useEffect(()=>{if(!cacheReady||!workspaceLookup)return;
    const key=cacheKey+"/draft";
    try{if(body||draftFiles.length)sessionStorage.setItem(key,JSON.stringify({body,files:draftFiles.map(f=>f.file.name)}));else sessionStorage.removeItem(key);}catch{/* Keep the visible draft; leaving protection remains active. */}
  },[cacheReady,cacheKey,body,draftFiles,workspaceLookup]);
  const [noticeExpired,setNoticeExpired]=useState(false);
  const cachedPendingMatches = (operation: ConsultationOperation) => {
    const raw = sessionStorage.getItem(cacheKey);
    const cached = raw ? consultationOperationSchema.parse(JSON.parse(raw)) : null;
    return cached?.operationId === operation.operationId && cached.requestHash === operation.requestHash;
  };
  const retirePending = (operation: ConsultationOperation, job: ComposerJob) => {
    if (!ownsPending(operation, job) || !cachedPendingMatches(operation)) return false;
    sessionStorage.removeItem(cacheKey);sessionStorage.removeItem(cacheKey+"/guard");
    currentPending.current = null;
    operationGeneration.current++;
    setPending(null);setNoticeExpired(false);
    return true;
  };
  const releaseBusy = (job: ComposerJob) => {
    if (!ownsBusy(job)) return;
    busyOwner.current = null;
    setBusy(false);
    setProgress(null);
  };
  const expectedWorkspace=()=>{if(!workspaceLookup)return {};const raw=sessionStorage.getItem(cacheKey+"/guard");return {workspaceExpected:raw?JSON.parse(raw):props.mode==="staff"?props.workspaceExpected:undefined};};
  const callOperation=async(action:"commit"|"lookup"|"cancel",operation:ConsultationOperation)=>{
    const response=await fetch(postEndpoint,{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},
      body:JSON.stringify({...(props.mode==="staff"?{projectId:props.projectId}:{}),...expectedWorkspace(),action:props.mode==="staff"&&props.readOnlyLookup&&action==="lookup"?"inspect":action,operation})});
    const data:unknown=await response.json();
    if(!data||typeof data!=="object"||!("kind" in data))throw new Error("送信結果を確認できません。同じ送信で再試行してください。");
    return{response,data:data as {kind:string;messageId?:string;operationId?:string;requestHash?:string;files?:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]}};
  };
  const recordSaved=async(operation:ConsultationOperation,data:{kind:string;messageId?:string;operationId?:string;requestHash?:string},job:ComposerJob)=>{
    if(data.kind!=="committed"||!data.messageId||data.operationId!==operation.operationId||data.requestHash!==operation.requestHash)return false;
    if (!retirePending(operation, job)) return false;
    setBody("");setDraftFiles([]);
    if(fileRef.current)fileRef.current.value="";
    setNotice(props.mode === "client" ? "送信を保存しました。" : "送信を保存しました。メール通知の状態は送信内容と別に確認できます。");await refreshAfterSend();return true;
  };
  useEffect(()=>{
    let active=true;
    operationGeneration.current++;
    currentPending.current = null;
    busyOwner.current = null;
    setPending(null);setBody("");setDraftFiles([]);setBusy(false);setProgress(null);
    setError("");setNotice("");setNoticeExpired(false);setCacheReady(false);setHistoryUnavailable(false);setNewMessages(false);
    const initial = props.mode === "client" ? props.initialMessages : [];
    knownMessages.current = new Set(initial.map(message => message.id));
    historyLoaded.current = props.mode === "client";
    setMessages(initial);setClosed(props.closed ?? false);setRoughOks(null);setRoughOkSendingEnabled(false);setRoughOkActionsAllowed(false);
    if (fileRef.current) fileRef.current.value = "";
    try{
      const raw=sessionStorage.getItem(cacheKey),restored=raw?consultationOperationSchema.parse(JSON.parse(raw)):null;
      if(restored){
        currentPending.current=restored;setPending(restored);setBody(restored.body);
        const job={actor:actorKey,generation:operationGeneration.current};
        void callOperation("lookup",restored).then(async({data})=>{
          if(active&&ownsPending(restored,job)){
            if(data.kind==="notice_expired")setNoticeExpired(true);
            else await recordSaved(restored,data,job);
          }
        }).catch(()=>{if(active&&ownsPending(restored,job))setError("前回の送信結果を確認できません。同じ送信で再試行してください。");});
      }else if(props.mode==="staff"&&props.readOnlyLookup){
        const rawDraft=sessionStorage.getItem(cacheKey+"/draft");
        if(rawDraft){const saved=JSON.parse(rawDraft) as {body?:unknown;files?:unknown};if(typeof saved.body==="string")setBody(saved.body.slice(0,4000));if(Array.isArray(saved.files)&&saved.files.length)setError("本文の下書きを復元しました。添付の元ファイルをもう一度選択してください。");}
      }
      setCacheReady(true);
    }catch{setError("送信の記録を読み込めません。ページを読み込み直してください。");}
    return()=>{active=false;};
    // Actor scopes one composer; restoration must run before editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[cacheKey,actorKey]);
  const chooseFiles=async(files:File[])=>{
    const job={actor:actorKey,generation:operationGeneration.current};
    if (!ownsActor()) return;
    setError("");
    if(files.some(file=>!validConsultationFile(file.name,file.type,file.size))){setError("対応する画像・PDFは10MB、音声は50MBまでです。大きなファイルは共有URLをご利用ください。");return;}
    if(pending){
      if(files.length!==pending.files.length){setError("さっきと同じファイルを選んでください。変える時は「送るのをやめる」を押してください。");return;}
      const restored=await Promise.all(files.map(async(file,index)=>{
        const saved=pending.files[index];return saved&&file.name===saved.fileName&&file.type===saved.mimeType&&file.size===saved.sizeBytes&&await consultationDigest(await file.arrayBuffer())===saved.sha256?{id:saved.id,file}:null;
      }));
      if (!ownsPending(pending, job)) return;
      if(restored.some(file=>!file)){setError("前回と同じ添付を選択してください。");return;}
      setDraftFiles(restored.filter((file):file is {id:string;file:File}=>file!==null));return;
    }
    if(draftFiles.length+files.length>10){setError("一度の送信で選べる添付は10件までです。");return;}
    setDraftFiles(current=>[...current,...files.map(file=>({id:crypto.randomUUID(),file}))]);
  };
  const send=async()=>{
    if(workspaceLookup&&props.mode==="staff"&&!props.clientEmail){setError("登録された宛先を確認できません。相談は送信しません。");return;}
    if(busyOwner.current||busy||noticeExpired||!cacheReady||(!pending&&!body.trim()&&!draftFiles.length)||!ownsActor())return;
    const job={actor:actorKey,generation:++operationGeneration.current};
    busyOwner.current=job;setBusy(true);setError("");setNotice("");
    try{
      const operation=pending??await freezeConsultationOperation(body,draftFiles);
      if (!ownsAttempt(job)) return;
      if (pending ? !cachedPendingMatches(operation) : sessionStorage.getItem(cacheKey) !== null) throw new Error("\u4fdd\u5b58\u3055\u308c\u305f\u9001\u4fe1\u306e\u8a18\u9332\u304c\u5909\u308f\u3063\u3066\u3044\u307e\u3059\u3002\u5165\u529b\u3092\u4fdd\u6301\u3057\u3066\u3001\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      if(workspaceLookup&&!pending)sessionStorage.setItem(cacheKey+"/guard",JSON.stringify(reviewGuard.current??(props.mode==="staff"?props.workspaceExpected:null)));
      sessionStorage.setItem(cacheKey,JSON.stringify(operation));currentPending.current=operation;setPending(operation);
      const preparedResponse=await fetch("/api/natori/consultation-file",{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},
        body:JSON.stringify({...actor,...expectedWorkspace(),action:"prepare",operation})});
      const prepared=await preparedResponse.json() as {kind:string;messageId?:string;operationId?:string;requestHash?:string;files?:{id:string;path:string;uploaded:boolean;uploadToken?:string}[]};
      if (!ownsPending(operation, job)) return;
      if(await recordSaved(operation,prepared,job))return;
      if(prepared.kind==="notice_expired"){setNoticeExpired(true);return;}
      if(!preparedResponse.ok||prepared.kind!=="prepared"||!prepared.files||prepared.files.length!==operation.files.length)throw new Error("送信を確定できません。「もう一度送る」か「送るのをやめる」を押してください。");
      for(const reservation of prepared.files){
        const descriptor=operation.files.find(file=>file.id===reservation.id);if(!descriptor)throw new Error("添付の予約を確認できません。");
        if(reservation.uploaded)continue;
        const draft=draftFiles.find(file=>file.id===reservation.id);
        if(!draft||!reservation.uploadToken)throw new Error("前回と同じ添付をもう一度選び、同じ送信で再試行してください。");
        const storageUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;if(!storageUrl)throw new Error("アップロード先を確認できませんでした。");
        const {Upload}=await import("tus-js-client");
        if (!ownsPending(operation, job)) return;
        setProgress(0);
        await new Promise<void>((resolve,reject)=>{
          const upload=new Upload(draft.file,{endpoint:consultationUploadEndpoint(storageUrl),retryDelays:[0,3000,5000,10000],
            headers:{"x-signature":reservation.uploadToken!},metadata:{bucketName:"natori-consultations",objectName:reservation.path,contentType:descriptor.mimeType},
            chunkSize:6*1024*1024,removeFingerprintOnSuccess:true,uploadDataDuringCreation:true,
            onProgress:(uploaded,total)=>{if(ownsPending(operation,job))setProgress(Math.round(uploaded/total*100));},onError:reject,onSuccess:()=>resolve()});
          upload.start();
        });
      }
      if (!ownsPending(operation, job)) return;
      const committed=await callOperation("commit",operation);
      if (!ownsPending(operation, job)) return;
      if(committed.data.kind==="notice_expired"){setNoticeExpired(true);return;}
      if(!committed.response.ok||!await recordSaved(operation,committed.data,job))throw new Error("送信結果を確認できません。同じ送信で再試行してください。");
    }catch(err){if(ownsAttempt(job))setError(err instanceof Error?err.message:"送信結果を確認できません。同じ送信で再試行してください。");}
    finally{releaseBusy(job);}
  };
  const cancelPending=async()=>{
    if(!pending||busyOwner.current||busy||!ownsActor())return;
    const job={actor:actorKey,generation:++operationGeneration.current};
    busyOwner.current=job;setBusy(true);setError("");
    try{
      const operation=pending;
      if (!cachedPendingMatches(operation)) throw new Error("\u4fdd\u5b58\u3055\u308c\u305f\u9001\u4fe1\u306e\u8a18\u9332\u304c\u5909\u308f\u3063\u3066\u3044\u307e\u3059\u3002\u5165\u529b\u3092\u4fdd\u6301\u3057\u3066\u3001\u30da\u30fc\u30b8\u3092\u518d\u8aad\u307f\u8fbc\u307f\u3057\u3066\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002");
      const {response,data}=await callOperation("cancel",operation);
      if (!ownsPending(operation, job)) return;
      if(await recordSaved(operation,data,job))return;
      if(!response.ok||data.kind!=="cancelled")throw new Error("取消を確認できません。入力を変更せず、もう一度確認してください。");
      if (!retirePending(operation, job)) return;
      setNotice("送信を取り消しました。本文と選択済み添付は下書きに残しています。"+(noticeExpired&&operation.files.length>draftFiles.length?"未選択の添付は同じファイルを選び直してください。":""));
    }catch(err){if(ownsAttempt(job))setError(err instanceof Error?err.message:"取消を確認できません。");}
    finally{releaseBusy(job);}
  };


  const retry = async (messageId: string) => {
    if (props.mode !== "staff" || busyOwner.current || busy || !ownsActor()) return;
    const job={actor:actorKey,generation:operationGeneration.current};
    busyOwner.current=job;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(postEndpoint, {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: props.projectId, retryMessageId: messageId }),
      });
      const result = await response.json() as { error?: string; notificationFailed?: boolean };
      if (!ownsBusy(job)) return;
      if (!response.ok || result.notificationFailed) throw new Error(result.error ?? "メールを再送できませんでした");
      setNotice("メール通知を再送しました。");
      await refreshAfterSend();
    } catch (err) {
      if(ownsBusy(job))setError(err instanceof Error ? err.message : "メールを再送できませんでした");
    } finally { releaseBusy(job); }
  };

  /** Staff marks (or un-marks) one of their attachment messages as a rough. Only an annotation: nothing is sent to the client. */
  const markRough = async (messageId: string, action: "mark" | "unmark") => {
    if (props.mode !== "staff" || busyOwner.current || busy || !ownsActor()) return;
    const job={actor:actorKey,generation:operationGeneration.current};
    busyOwner.current=job;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/natori/admin/consultation/rough", {
        method: "POST", headers: { ...CSRF_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: props.projectId, messageId, action }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!ownsBusy(job)) return;
      if (!response.ok) throw new Error(result.error ?? "ラフの設定を変更できませんでした");
      setNotice(action === "mark" ? "ラフとして提出しました。依頼者の相談ページに「このラフでOK」のカードが出ます。" : "ラフの指定を外しました。");
      await refreshAfterSend();
    } catch (err) {
      if(ownsBusy(job))setError(err instanceof Error ? err.message : "ラフの設定を変更できませんでした");
    } finally { releaseBusy(job); }
  };

  const roughOkAction = async (roughId: string, action: "acknowledge" | "retry-notification") => {
    if (props.mode !== "staff" || busyOwner.current || busy || !ownsActor() || !roughOkActionsAllowed) return;
    const job = { actor: actorKey, generation: operationGeneration.current };
    busyOwner.current = job; setBusy(true); setError("");
    try {
      const response = await fetch("/api/natori/admin/consultation/rough-ok", { method: "POST",
        headers: { ...CSRF_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ projectId: props.projectId, roughId, action }) });
      const result: unknown = await response.json().catch(() => null);
      if (!ownsBusy(job)) return;
      if (!response.ok || !result || typeof result !== "object" || !("ok" in result) || result.ok !== true || !("roughId" in result) || result.roughId !== roughId) throw new Error("ラフOKの操作結果を確認できません。履歴を更新して確認してください。");
      setNotice(action === "acknowledge" ? "このラフOKの次の対応を確認済みにしました。依頼者のOK記録は保持されています。" : "このラフOKのメールを再試行しました。通知の状態を確認してください。");
      changed?.();
      await reload();
    } catch (err) {
      if (ownsBusy(job)) setError(err instanceof Error ? err.message : "ラフOKの操作結果を確認できません。");
    } finally { releaseBusy(job); }
  };

  const cannotSend = closed || (props.mode === "staff" && !props.clientEmail);
  const t = threadTone[props.mode];
  // On phones the client's input bar stays at the bottom of the screen (LINE-like);
  // staff mode lives inside the admin panel's own scroll area and keeps its layout.
  const sticky = props.mode === "client";
  return (
    <section className={t.section} aria-label="相談のやり取り">
      <div className={`flex items-center justify-between gap-3 border-b ${t.rule} ${t.pad} py-3`}>
        <h3 className={`flex min-w-0 items-center gap-2 ${t.title}`}><MessageCircle className={`h-4 w-4 shrink-0 ${t.titleIcon}`} aria-hidden />相談のやり取り</h3>
        <button type="button" disabled={loading || busy} onClick={() => void refresh()} className={`${t.secondary} shrink-0`}><RefreshCw className={`h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} aria-hidden />履歴を更新</button>
      </div>
      <div className={`space-y-2 ${t.pad} pt-3`}>
        <p className={t.caption}>{props.mode === "client" ? "ナトリからの返事はメールでもお知らせします。ご返信はこの相談ページからお願いします。メールに返信しても、ここには載りません。" : "相談内容とメール通知の状態は別に記録されます。メールへの直接返信は、この履歴には自動で入りません。"}</p>
        {newMessages && !loading ? <button type="button" onClick={showLatest} className={`inline-flex items-center gap-1 ${t.textButton}`}><ArrowDown className="h-3.5 w-3.5" aria-hidden />新しいやり取りを見る</button> : null}
        {props.mode === "staff" && !props.clientEmail ? <p className={t.warning}>依頼者のメールアドレスがないため返信できません。</p> : null}
        {loading ? <p role="status" className={t.caption}>履歴を確認中…</p> : null}
        {props.mode === "staff" && !loading && !historyUnavailable ? <RoughOkFollowups key={actorKey} rows={roughOks} messages={messages} closed={closed} actionsAllowed={roughOkActionsAllowed} busy={busy} sendingEnabled={roughOkSendingEnabled} onAction={roughOkAction} /> : null}
      </div>
      {!loading && !historyUnavailable && messages.length === 0 ? <p className={`${t.pad} py-6 text-center ${t.caption}`}>{closed ? "相談履歴はありません。" : "返信はまだありません。最初のメッセージを送れます。"}</p> : null}
      {messages.length > 0 ? (
        <ol className={`space-y-4 ${t.pad} py-4`}>
          {messages.map((message, index) => {
            const own = props.mode === "client" ? message.sender === "client" : message.sender === "staff";
            return (
              <li id={`consultation-message-${message.id}`} key={message.id} ref={index === messages.length - 1 ? lastMessageRef : undefined} tabIndex={-1} className={`flex flex-col rounded-2xl ${natoriClientUi.focus} ${own ? "items-end" : "items-start"}`}>
                <p className={`mb-1 px-1 ${t.meta}`}>{message.sender === "staff" ? "ナトリ" : props.mode === "client" ? "あなた" : "依頼者"} · {dateTime(message.createdAt)}</p>
                <div className={`min-w-0 max-w-[88%] px-4 py-3 sm:max-w-[80%] ${own ? t.own : t.other}`}>
                  <p className={`whitespace-pre-wrap break-words ${t.body}`}>{renderText(message.body)}</p>
                  {message.filesState==="unavailable"?<p role="status" className={`mt-2 ${t.warning}`}>添付一覧を取得できません。資料の提出状況は、履歴を更新して確認してください。</p>:null}
                  {message.files?.map(file=>file.url?(
                    <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className={`mt-2 flex items-center gap-2 break-all rounded-xl border px-3 py-2 text-[13px] font-bold leading-5 underline underline-offset-2 transition-colors ${t.file} ${natoriClientUi.focus}`}>
                      <Paperclip className="h-4 w-4 shrink-0" aria-hidden/>{file.name} ({(file.sizeBytes/1024/1024).toFixed(1)}MB)
                    </a>
                  ):<p key={file.id} role="status" className={`mt-2 break-all rounded-xl border border-dashed p-3 ${t.caption}`}>{file.name} — 提出済みの添付です。リンクの取得に失敗しました。履歴を更新してください。</p>)}
                </div>
                {message.notificationStatus === "failed" && (props.mode === "client" ? message.sender === "client" : message.sender !== "staff" || closed) ? <p className={`mt-1 px-1 ${t.warning}`}>メール通知に失敗 · 相談内容は保存済み</p> : null}
                {message.notificationStatus === "pending" && (props.mode === "staff" || message.sender === "client") ? <p className={`mt-1 px-1 ${t.caption}`}>通知未送信・処理中 · 相談内容は保存済み</p> : null}
                {message.rough ? <p className={`mt-1 px-1 ${t.caption}`}>{roughNote(message.rough, props.mode)}</p> : null}
                {props.mode === "staff" && !closed && message.sender === "staff" && ((message.files?.length ?? 0) > 0 || message.attachmentsExist === true) && !message.rough?.okAt ? (
                  <button type="button" disabled={busy} onClick={() => void markRough(message.id, message.rough ? "unmark" : "mark")} className={`mt-1 px-1 ${t.textButton} disabled:cursor-not-allowed disabled:text-zinc-500`}>
                    {message.rough ? "ラフの指定を外す" : "ラフとして提出"}
                  </button>
                ) : null}
                {props.mode === "staff" && !closed && message.sender === "staff" && message.notificationStatus === "failed" ? (
                  <button type="button" disabled={busy} onClick={() => void retry(message.id)} className={`mt-1 px-1 ${t.retry} disabled:cursor-not-allowed disabled:text-zinc-500`}>メール通知に失敗 · 再送する</button>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {messages.some((message) => message.files?.length) ? <p className={`${t.pad} pb-3 ${t.caption}`}>添付が開けない場合は、ページを再読み込みしてください。</p> : null}
      {!cannotSend ? (
        <div className={`space-y-3 border-t ${t.rule} ${t.pad} py-4`}>
          <input ref={fileRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.mp3,.m4a,.wav" className="hidden" aria-label="相談ファイルを選ぶ" onChange={(event)=>{const files=Array.from(event.target.files??[]);void chooseFiles(files);if(fileRef.current)fileRef.current.value="";}} />
          <p className={t.caption}>画像・PDFは10MB、音声は50MBまで送れます。大きいファイルは共有URLを貼ってください。</p>
          {(pending?pending.files.map(file=>({id:file.id,name:file.fileName,size:file.sizeBytes})):draftFiles.map(({id,file})=>({id,name:file.name,size:file.size}))).map(file=>(
            <div key={file.id} className={`flex items-center justify-between gap-2 px-3 py-2 ${t.draft}`}>
              <Paperclip className="h-4 w-4 shrink-0 text-[#BE185D]" aria-hidden />
              <span className="min-w-0 flex-1 break-all">{file.name} ({(file.size/1024/1024).toFixed(1)}MB)</span>
              {!pending?<button type="button" disabled={busy} onClick={()=>setDraftFiles(current=>current.filter(draft=>draft.id!==file.id))} aria-label={file.name+"の添付を取り消す"} className={`shrink-0 ${t.textButton}`}>取消</button>:null}
            </div>
          ))}
          {pending?<p role="status" className={t.warning}>{noticeExpired?"送れたか確認できませんでした。書いた内容は残っています。"+(pending.files.length>draftFiles.length?"添付は同じファイルを選び直してください。":"")+"「送るのをやめる」を押してから、もう一度送ってください。":"前回の送信が届いたか確認しています。内容を変える時は、先に「送るのをやめる」を押してください。"}</p>:null}
          {pending?<button type="button" disabled={busy} onClick={()=>void cancelPending()} className={t.textButton}>送るのをやめる</button>:null}
          {progress !== null ? <p role="status" className={`${t.caption} font-bold text-[#BE185D]`}>アップロード中 {progress}%</p> : null}
          <div className={sticky ? "max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-4 max-sm:space-y-2 max-sm:border-t max-sm:border-[#F6E3E9] max-sm:bg-white max-sm:px-4 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-sm:pt-2" : "space-y-3"}>
          <label className={`block ${sticky ? "max-sm:sr-only " : ""}${t.label}`} htmlFor="consultation-reply">メッセージ</label>
          <textarea id="consultation-reply" autoFocus={props.mode === "staff" && props.standalone} value={body} disabled={busy||Boolean(pending)||!cacheReady} onChange={(event) => setBody(event.target.value)} maxLength={4000} rows={sticky ? 3 : 4}
            placeholder="相談への返信や共有URLを入力してください" className={`${t.textarea} block`} />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || loading || historyUnavailable} className={t.secondary}><Paperclip className="h-4 w-4" aria-hidden />添付を選ぶ</button>
            <button type="button" onClick={() => {if(workspaceLookup&&!pending){reviewGuard.current=props.mode==="staff"?props.workspaceExpected:undefined;setReview(true);}else void send();}} disabled={(!pending&&!body.trim()&&!draftFiles.length)||busy||loading||historyUnavailable||!cacheReady||noticeExpired}
              className={`ml-auto ${t.primary}`}><Send className="h-4 w-4" aria-hidden />{busy?"送信中…":pending?"もう一度送る":workspaceLookup?"相談の送信前確認へ":"メッセージを送信"}</button>
          </div>
          {props.mode==="staff"&&props.readOnlyLookup&&review?<div className="space-y-2 rounded-xl border border-pink-200 bg-pink-50 p-3 text-sm"><p className="font-semibold">相談の送信前確認</p><p>宛先：{props.clientEmail} / この案件の相談</p><pre className="whitespace-pre-wrap break-words">{body}</pre><ul>{draftFiles.map(f=><li key={f.id}>{f.file.name}</li>)}</ul><p>本文の保存と通知受付は別の結果です。</p><button type="button" className={t.primary} disabled={busy} onClick={()=>{setReview(false);void send();}}>確認した相談を送信</button><button type="button" className={t.secondary} onClick={()=>setReview(false)}>確認を取り消す</button></div>:null}
          </div>
        </div>
      ) : closed ? <p className={`border-t ${t.rule} ${t.pad} py-4 ${t.caption}`}>この相談は終了しています。履歴のみ確認できます。</p> : null}
      {notice || error ? (
        <div className={`space-y-2 ${t.pad} pb-4`}>
          {notice ? <p role="status" className={t.alertSuccess}>{notice}</p> : null}
          {error ? <p role="alert" className={t.alertError}>{error}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
