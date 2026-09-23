"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import QuoteAcceptCard from "@/features/natori/components/quote/QuoteAcceptCard";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { buildNatoriInquiryRequestView } from "@/features/natori/lib/inquiryRequestView";
import { buildEstimateMailDraft, resolveClientEmail } from "@/features/natori/lib/orderMail";
import { defaultEstimateTerms, estimateTotal, validateEstimateTermsForIssue, type NatoriAgreedTerms, type NatoriEstimateDraft, type NatoriEstimateDraftData } from "@/features/natori/lib/estimateDraft";
import { createNatoriEstimateSuggestionV1 } from "@/features/natori/lib/pricingSuggestion";
import { createPortfolioStructuredPricingConfig } from "@/features/natori/lib/portfolioPricing";
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import { createStructuredQuoteOperationAttempt } from "@/features/natori/lib/structuredQuoteAttempt";
import { formatYen } from "@/features/natori/lib/pricing";
import { confirmNatoriProjectType } from "@/features/natori/data/supabaseProjects";
import { NATORI_CONCRETE_PROJECT_TYPES, NATORI_PROJECT_TYPE_LABELS } from "@/features/natori/lib/projectReadModel";
import type { NatoriConcreteProjectType, NatoriProject } from "@/features/natori/types/projects";
import type { NatoriQuoteSnapshotItemV1 } from "@/features/natori/types/quoteSnapshot";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

type Step = 1 | 2 | 3;
type Props = { project: NatoriProject; portfolioContent: PortfolioContent | null };
const field = "w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100";
const scopeLabels: Record<NatoriAgreedTerms["scope"], string> = {
  undecided: "相談して決める", bust_up: "胸上", waist_up: "膝〜腰上", full_body: "全身", sd: "SD", other: "その他",
};

function scopeText(terms: NatoriAgreedTerms) {
  return terms.scope === "other" ? terms.scopeNote.trim() : scopeLabels[terms.scope];
}

function editableItem(item: NatoriQuoteSnapshotItemV1): NatoriQuoteSnapshotItemV1 {
  return { ...item, kind: "manual", automatic: false, presetItemId: null, sourceFields: [], ruleId: null };
}

export default function EstimateJourney({ project, portfolioContent }: Props) {
  const [currentProject, setCurrentProject] = useState(project);
  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<NatoriEstimateDraftData>({ agreedTerms: defaultEstimateTerms(project), items: [] });
  const [saved, setSaved] = useState<NatoriEstimateDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [typeSelection, setTypeSelection] = useState<NatoriConcreteProjectType | "">("");
  const [to, setTo] = useState(resolveClientEmail(project) ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [issued, setIssued] = useState<{ quoteId: string; version: number } | null>(null);
  const attemptRef = useRef<Record<string, unknown> | null>(null);

  const original = useMemo(() => buildNatoriInquiryRequestView(project.requestData), [project.requestData]);
  const request = useMemo(() => readNatoriRequestData(project.requestData), [project.requestData]);
  const pricingConfig = useMemo(() => portfolioContent ? createPortfolioStructuredPricingConfig(portfolioContent) : null, [portfolioContent]);
  const dirty = saved ? JSON.stringify({ agreedTerms: saved.agreedTerms, items: saved.items }) !== JSON.stringify(draft) : true;
  const total = estimateTotal(draft.items);
  const missing = validateEstimateTermsForIssue(draft.agreedTerms);
  if (currentProject.type === "undecided") missing.unshift("案件種別");
  if (draft.items.length === 0 || total <= 0 || !Number.isSafeInteger(total) || total > 2147483647) missing.push("見積明細・合計金額");
  if (project.requestData != null && !request.success) missing.push("原依頼の読み取り");
  if (request.success && request.data.options.some((option) => option.id === "copyright_transfer")) missing.push("著作権譲渡の個別確認");
  const ready = missing.length === 0 && !dirty && saved !== null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/natori/admin/estimate-draft?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("見積りの下書きを読み込めませんでした。時間をおいて再試行してください。");
        return response.json() as Promise<{ draft: NatoriEstimateDraft | null }>;
      })
      .then(({ draft: existing }) => {
        if (cancelled || !existing) return;
        setSaved(existing);
        setDraft({ agreedTerms: existing.agreedTerms, items: existing.items });
      })
      .catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "読み込みに失敗しました"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id]);

  const changeTerms = (key: keyof NatoriAgreedTerms, value: string) => {
    attemptRef.current = null;
    setDraft((previous) => ({ ...previous, agreedTerms: { ...previous.agreedTerms, [key]: value } }));
  };

  const save = async (): Promise<NatoriEstimateDraft | null> => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/natori/admin/estimate-draft", {
        method: "PUT", headers: { "Content-Type": "application/json", ...CSRF_HEADERS },
        body: JSON.stringify({ projectId: project.id, revision: saved?.revision ?? 0, ...draft }),
      });
      const result = await response.json() as { draft?: NatoriEstimateDraft; error?: string };
      if (!response.ok || !result.draft) throw new Error(response.status === 409
        ? "別の画面で下書きが更新されました。再読み込みして確認してください。"
        : "保存できませんでした。入力内容をご確認ください。");
      setSaved(result.draft);
      attemptRef.current = null;
      return result.draft;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存できませんでした");
      return null;
    } finally { setBusy(false); }
  };

  const nextFromTerms = async () => { if (!dirty || await save()) { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const nextFromPrice = async () => {
    if (dirty && !await save()) return;
    const terms = draft.agreedTerms;
    const mail = buildEstimateMailDraft({
      clientName: project.clientName, title: project.title, amount: total,
      breakdownLines: draft.items.map((item) => `${item.labelSnapshot} × ${item.quantity}: ${formatYen(item.amount)}`),
      deliverables: terms.deliverables, dueDate: terms.dueDate,
      scope: scopeText(terms), usage: terms.usage,
      commercialUse: terms.commercialUse === "yes" ? "あり" : "なし", publication: terms.publication,
    });
    setSubject(mail.subject); setBody(mail.body); setAcknowledged(false);
    setStep(3); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const suggest = () => {
    if (!request.success || !pricingConfig || currentProject.type === "undecided") return;
    if (draft.items.length > 0 && !window.confirm("編集中の明細を公開料金の候補で置き換えますか？")) return;
    const terms = draft.agreedTerms;
    const scope = terms.scope;
    if (scope === "undecided" || scope === "other") {
      setError("制作範囲を決めてから料金候補を読み込んでください。その他の範囲は明細を手動で入力できます。");
      return;
    }
    const suggestion = createNatoriEstimateSuggestionV1({
      projectType: currentProject.type,
      pricingConfig,
      requestData: {
        ...request.data,
        requestType: scope === "sd" ? "sd" : request.data.requestType === "sd" ? "illustration" : request.data.requestType,
        commissionScope: scope === "sd" ? "undecided" : scope,
        commercialUse: terms.commercialUse === "yes" ? "yes" : "none",
        publicationPolicy: "unknown",
        options: terms.commercialUse === "yes" ? request.data.options : request.data.options.filter((option) => option.id !== "commercial_use"),
      },
      deliveryPlan: currentProject.deliveryPlan ?? "normal",
    });
    const items: NatoriQuoteSnapshotItemV1[] = suggestion.automaticItems.map((item) => ({
      id: item.id, presetItemId: item.presetItemId, kind: item.kind,
      labelSnapshot: item.labelSnapshot, quantity: item.quantity,
      unitAmount: item.unitAmount, amount: item.amount, automatic: true,
      sourceFields: item.sourceFields, ruleId: item.ruleId, note: item.note ?? null,
    }));
    setDraft((previous) => ({ ...previous, items })); setError("");
  };

  const updateItem = (id: string, fieldName: "labelSnapshot" | "quantity" | "unitAmount", value: string) => {
    setDraft((previous) => ({ ...previous, items: previous.items.map((item) => {
      if (item.id !== id) return item;
      const edited = editableItem(item);
      if (fieldName === "labelSnapshot") return { ...edited, labelSnapshot: value };
      const number = value === "" ? 0 : Number(value);
      const next = { ...edited, [fieldName]: number };
      return { ...next, amount: next.quantity * next.unitAmount };
    }) }));
  };

  const confirmType = async () => {
    if (!typeSelection) return;
    setBusy(true); setError("");
    try {
      await confirmNatoriProjectType(project.id, typeSelection);
      setCurrentProject((previous) => ({ ...previous, type: typeSelection }));
    } catch { setError("案件種別を確定できませんでした。案件の状態をご確認ください。"); }
    finally { setBusy(false); }
  };

  const issue = async () => {
    if (!ready || !acknowledged || busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject.trim() || !body.trim()) return;
    setBusy(true); setError("");
    try {
      const attempt = createStructuredQuoteOperationAttempt(project.id);
      const requestBody = attemptRef.current ?? {
        projectId: project.id, toEmail: to.trim(), subject: subject.trim(), bodySnapshot: body,
        ...attempt, draftRevision: saved!.revision,
        requestSnapshot: request.success ? request.data : null,
        pricingSnapshot: {
          schemaVersion: 1, mappingVersion: "natori-agreed-estimate-v1", pricingConfigVersion: 1,
          pricingPresetId: null, pricingPresetNameSnapshot: "今回の見積り", projectTypeSnapshot: currentProject.type,
          items: saved!.items, agreedTerms: saved!.agreedTerms,
          reviewItems: [], reviewResolutions: [],
          subtotalBeforePercentage: saved!.items.filter((item) => item.kind !== "percentage").reduce((sum, item) => sum + item.amount, 0),
          total: estimateTotal(saved!.items), currency: "JPY", issuedAt: attempt.issuedAt,
        },
      };
      attemptRef.current = requestBody;
      const response = await fetch("/api/natori/admin/structured-quote", {
        method: "POST", headers: { "Content-Type": "application/json", ...CSRF_HEADERS }, body: JSON.stringify(requestBody),
      });
      const result = await response.json() as { ok?: boolean; error?: string; quoteId?: string; version?: number; retryable?: boolean };
      if (!response.ok || !result.ok || !result.quoteId || !result.version) {
        if (response.status < 500 && !result.retryable) attemptRef.current = null;
        throw new Error(result.error ?? "送信できませんでした。内容をご確認ください。");
      }
      setIssued({ quoteId: result.quoteId, version: result.version });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "送信できませんでした"); }
    finally { setBusy(false); }
  };

  if (loading) return <p className="rounded-2xl bg-white p-6 text-sm">見積りの下書きを読み込んでいます…</p>;
  if (error && !saved && /読み込めませんでした/.test(error)) return <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
      <header className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
        <Link href="/natori/dashboard" className="text-sm font-bold text-pink-700 underline underline-offset-4">← 案件管理へ戻る</Link>
        <p className="mt-4 text-xs font-bold text-pink-700">{project.clientName} 様の見積り</p>
        <h1 className="mt-1 break-words text-xl font-black text-gray-950">{project.title}</h1>
        <p className="mt-2 text-sm text-gray-600">相談で決まった内容から見積りを作り、相手に見える内容を確かめて送信します。</p>
      </header>

      <nav aria-label="見積りの手順" className="grid grid-cols-3 gap-2">
        {(["① 条件を整理", "② 金額を決める", "③ 確認して送る"] as const).map((label, index) => (
          <button key={label} type="button" onClick={() => { if (index + 1 < step) setStep((index + 1) as Step); }}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`min-h-12 rounded-xl px-2 text-center text-xs font-bold sm:text-sm ${step === index + 1 ? "bg-pink-500 text-white" : index + 1 < step ? "bg-pink-50 text-pink-700" : "bg-gray-100 text-gray-500"}`}>
            {label}
          </button>
        ))}
      </nav>
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {step === 1 ? (
        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div><h2 className="text-lg font-black">今回決まった条件</h2><p className="mt-1 text-sm text-gray-600">依頼者の最初の回答は残したまま、相談後の内容をここに記録します。</p></div>
          {original.kind === "structured" ? (
            <details className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <summary className="cursor-pointer font-bold">最初に届いた依頼を見る</summary>
              <div className="mt-3 space-y-3">{original.sections.map((section) => (
                <div key={section.key}><h3 className="font-bold text-gray-800">{section.title}</h3>
                  {section.fields.map((entry) => <p key={entry.key} className="mt-1 text-gray-600">{entry.label}：{entry.value}</p>)}
                </div>
              ))}</div>
            </details>
          ) : original.kind === "unsupported"
            ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">原依頼を読み取れません。内容を確認するまで正式見積りは発行できません。</p>
            : <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">ポートフォリオ以外からのご相談も、ここに決まった条件を記録できます。</p>}

          <div><label htmlFor="estimate-type" className="mb-1 block text-sm font-bold">案件種別（制作タスク）</label>
            {currentProject.type !== "undecided" ? <p className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{NATORI_PROJECT_TYPE_LABELS[currentProject.type]} · 確定済み</p> : (
              <div className="flex flex-wrap gap-2"><select id="estimate-type" value={typeSelection} onChange={(event) => setTypeSelection(event.target.value as NatoriConcreteProjectType | "")} className={`${field} flex-1`}>
                <option value="">選択してください</option>{NATORI_CONCRETE_PROJECT_TYPES.map((type) => <option key={type} value={type}>{NATORI_PROJECT_TYPE_LABELS[type]}</option>)}
              </select><button type="button" disabled={!typeSelection || busy} onClick={confirmType} className="rounded-xl bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-50">種別を確定</button></div>
            )}<p className="mt-1 text-xs text-gray-600">確定すると制作タスクが作られます。変更が必要な場合は案件ボードで確認してください。</p>
          </div>
          <div><label htmlFor="estimate-scope" className="mb-1 block text-sm font-bold">制作範囲</label><select id="estimate-scope" className={field} value={draft.agreedTerms.scope} onChange={(event) => changeTerms("scope", event.target.value)}>
            {Object.entries(scopeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>{draft.agreedTerms.scope === "other" ? <input className={`${field} mt-2`} aria-label="その他の制作範囲" placeholder="制作範囲を具体的に記入" value={draft.agreedTerms.scopeNote} onChange={(event) => changeTerms("scopeNote", event.target.value)} /> : null}</div>
          <div><label htmlFor="estimate-deliverables" className="mb-1 block text-sm font-bold">制作するもの</label><textarea id="estimate-deliverables" className={`${field} min-h-24`} placeholder="例：動画サムネイル用の一枚絵1点、表情差分1点、PNGで納品" value={draft.agreedTerms.deliverables} onChange={(event) => changeTerms("deliverables", event.target.value)} /></div>
          <div><label htmlFor="estimate-usage" className="mb-1 block text-sm font-bold">用途</label><input id="estimate-usage" className={field} placeholder="例：動画サムネイル、SNS告知" value={draft.agreedTerms.usage} onChange={(event) => changeTerms("usage", event.target.value)} /></div>
          <div><label htmlFor="estimate-commercial" className="mb-1 block text-sm font-bold">商用利用</label><select id="estimate-commercial" className={field} value={draft.agreedTerms.commercialUse} onChange={(event) => changeTerms("commercialUse", event.target.value)}><option value="unknown">相談して決める</option><option value="yes">あり</option><option value="no">なし</option></select></div>
          <div><label htmlFor="estimate-publication" className="mb-1 block text-sm font-bold">実績公開の条件</label><input id="estimate-publication" className={field} placeholder="例：2026年11月23日以降に公開可／公開不可" value={draft.agreedTerms.publication} onChange={(event) => changeTerms("publication", event.target.value)} /></div>
          <div><label htmlFor="estimate-due" className="mb-1 block text-sm font-bold">納品日</label><input id="estimate-due" type="date" className={field} value={draft.agreedTerms.dueDate} onChange={(event) => changeTerms("dueDate", event.target.value)} /><p className="mt-1 text-xs text-gray-600">正式見積りを送ると案件のカレンダーにも反映します。</p></div>
          <div><label htmlFor="estimate-memo" className="mb-1 block text-sm font-bold">内部メモ（依頼者には表示しません）</label><textarea id="estimate-memo" className={`${field} min-h-20`} value={draft.agreedTerms.memo} onChange={(event) => changeTerms("memo", event.target.value)} /></div>
          <button type="button" onClick={nextFromTerms} disabled={busy} className="min-h-12 w-full rounded-full bg-pink-500 px-5 font-bold text-white disabled:opacity-50">{busy ? "保存中…" : "条件を保存して金額へ →"}</button>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div><h2 className="text-lg font-black">今回の金額を決める</h2><p className="mt-1 text-sm text-gray-600">この案件だけの金額です。公開ポートフォリオの料金は変更されません。</p></div>
          {request.success && pricingConfig ? <button type="button" onClick={suggest} className="min-h-11 w-full rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-bold text-violet-900">公開料金から参考明細を入れる</button> : <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">明細を手動で追加できます。</p>}
          {draft.items.map((item) => <div key={item.id} className="space-y-2 rounded-xl border border-gray-200 p-3">
            <div className="flex gap-2"><input aria-label="明細名" className={field} value={item.labelSnapshot} onChange={(event) => updateItem(item.id, "labelSnapshot", event.target.value)} /><button type="button" aria-label={`${item.labelSnapshot}を削除`} onClick={() => setDraft((previous) => ({ ...previous, items: previous.items.filter((entry) => entry.id !== item.id) }))} className="rounded-lg p-2 text-red-600"><Trash2 className="h-5 w-5" /></button></div>
            <div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-gray-600">数量<input aria-label={`${item.labelSnapshot}の数量`} type="number" min={1} max={100} className={`${field} mt-1`} value={item.quantity} onChange={(event) => updateItem(item.id, "quantity", event.target.value)} /></label><label className="text-xs font-bold text-gray-600">単価（円）<input aria-label={`${item.labelSnapshot}の単価`} type="number" min={0} className={`${field} mt-1`} value={item.unitAmount} onChange={(event) => updateItem(item.id, "unitAmount", event.target.value)} /></label></div>
            <p className="text-right text-sm font-bold">小計 {Number.isFinite(item.amount) ? formatYen(item.amount) : "入力を確認"}</p>
          </div>)}
          <button type="button" onClick={() => setDraft((previous) => ({ ...previous, items: [...previous.items, { id: crypto.randomUUID(), presetItemId: null, kind: "manual", labelSnapshot: "追加作業", quantity: 1, unitAmount: 0, amount: 0, automatic: false, sourceFields: [], ruleId: null, note: null }] }))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-300 px-4 text-sm font-bold"><Plus className="h-4 w-4" />明細を追加</button>
          <div className="flex items-center justify-between rounded-xl bg-pink-50 p-4 font-bold"><span>今回の見積り合計</span><span className="text-xl">{draft.items.length ? formatYen(total) : "未入力"}</span></div>
          <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setStep(1)} className="min-h-12 rounded-full border border-gray-300 px-5 font-bold">← 条件へ戻る</button><button type="button" disabled={busy} onClick={nextFromPrice} className="min-h-12 flex-1 rounded-full bg-pink-500 px-5 font-bold text-white disabled:opacity-50">{busy ? "保存中…" : "明細を保存して送信確認へ →"}</button></div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          {issued ? <div className="rounded-xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mb-2 h-6 w-6" /><h2 className="font-black">正式見積りを発行しました</h2><p className="text-sm">第{issued.version}版の見積りとメールを送信しました。</p></div> : <>
            <div><h2 className="text-lg font-black">相手に見える内容を確認</h2><p className="mt-1 text-sm text-gray-600">送信前のプレビューです。金額・制作内容・納品日・メールを確認してください。</p></div>
            {missing.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" />送信前に決める項目</p><p className="mt-1">{missing.join("、")}</p></div> : null}
            {dirty ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">編集中の変更があります。戻って保存してから送信してください。</p> : null}
            <QuoteAcceptCard preview token="" title={project.title} clientName={project.clientName} amount={total} acceptedAt={null} expiresAt={new Date(Date.now() + 30 * 86400000).toISOString()}
              items={draft.items.map((item) => ({ label: item.labelSnapshot, quantity: item.quantity, amount: item.amount }))}
              terms={draft.agreedTerms.deliverables && draft.agreedTerms.dueDate ? {
                deliverables: draft.agreedTerms.deliverables, dueDate: draft.agreedTerms.dueDate,
                scope: scopeText(draft.agreedTerms), usage: draft.agreedTerms.usage,
                commercialUse: draft.agreedTerms.commercialUse === "yes" ? "あり" : "なし", publication: draft.agreedTerms.publication,
              } : null} />
            <div className="space-y-3 rounded-xl border border-gray-200 p-4"><h3 className="font-bold">送信するメール</h3>
              <div><label htmlFor="estimate-to" className="mb-1 block text-sm font-bold">宛先</label><input id="estimate-to" type="email" className={field} value={to} onChange={(event) => setTo(event.target.value)} disabled={Boolean(attemptRef.current)} /></div>
              <div><label htmlFor="estimate-subject" className="mb-1 block text-sm font-bold">件名</label><input id="estimate-subject" className={field} value={subject} onChange={(event) => setSubject(event.target.value)} disabled={Boolean(attemptRef.current)} /></div>
              <div><label htmlFor="estimate-body" className="mb-1 block text-sm font-bold">本文</label><textarea id="estimate-body" className={`${field} min-h-80`} value={body} onChange={(event) => setBody(event.target.value)} disabled={Boolean(attemptRef.current)} /></div>
            </div>
            <label className="flex items-start gap-3 rounded-xl bg-pink-50 p-4 text-sm"><input type="checkbox" className="mt-1" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>依頼者に見える内容と宛先を確認しました。</span></label>
            <div className="flex flex-col gap-2 sm:flex-row"><button type="button" onClick={() => setStep(2)} disabled={Boolean(attemptRef.current)} className="min-h-12 rounded-full border border-gray-300 px-5 font-bold disabled:opacity-50">← 金額を修正</button><button type="button" onClick={issue} disabled={!ready || !acknowledged || busy || !to.trim() || !subject.trim() || !body.trim()} className="min-h-12 flex-1 rounded-full bg-pink-500 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : attemptRef.current ? "同じ内容で送信を再試行" : `正式見積り ${formatYen(total)} を発行`}</button></div>
          </>}
        </section>
      ) : null}
      <p className="text-xs leading-5 text-gray-500">発行後の見積りは上書きされません。変更する場合は新しい版を発行します。</p>
    </div>
  );
}
