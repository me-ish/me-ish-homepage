"use client";

// features/natori/components/portfolio/PortfolioCommissionForm.tsx
// ご依頼フォーム。送信すると /api/natori/portfolio/contact 経由でナトリ宛に
// メールが飛び、案件（依頼受付）として自動起票される。
// 料金カードの「このプランで相談」からの遷移でプランが自動選択される。
import { NATORI_INTAKE_COPY } from "@/features/natori/constants/portfolioContactCopy";
import { natoriPrimaryActionClassName } from "@/features/natori/constants/natoriPrimaryAction";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PLAN_SELECT_EVENT,
  isPortfolioTsunaguLink,
  planChoiceLabel,
  portfolioBudgetOptions,
  portfolioColors as c,
  portfolioDeadlineOptions,
  type PortfolioPlanSelectDetail,
} from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import {
  NATORI_MAX_REFERENCE_IMAGES,
  NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES,
  NATORI_REFERENCE_IMAGE_MAX_BYTES,
} from "@/features/natori/lib/portfolioRequestForm";
import {
  portfolioWorkConsultationMessage,
  withPortfolioConsultationWork,
} from "@/features/natori/lib/portfolioWorkConsultation";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { useIntakeOperation, type IntakeCompleted } from "./useIntakeOperation";
import IntakeRecoveryPanel from "./IntakeRecoveryPanel";
import { loadIntakeReceipts, retireCompletedIntakeOperation, type IntakeReceipt } from "../../data/intakeOperationClient";
import PortfolioLegalNotice from "./PortfolioLegalNotice";
import PortfolioStructuredCommissionForm from "./PortfolioStructuredCommissionForm";

type Status = "idle" | "sending" | "success" | "error";

const inputClass = "pf-cute-focus pf-form-control w-full rounded-lg border-2 px-3 py-2";
const labelClass = "mb-1.5 block text-sm font-bold";

const PLAN_UNDECIDED = "未定・相談して決めたい";
const REQUEST_TYPE_OTHER = "その他";
const MAX_REF_IMAGES = NATORI_MAX_REFERENCE_IMAGES;
const REF_IMAGE_MAX_BYTES = NATORI_REFERENCE_IMAGE_MAX_BYTES;

type RefImageEntry = { file: File; previewUrl: string };

const DETAILS_TEMPLATE = [
  "【キャラクターの特徴】",
  "（髪型・髪色・目の色・服装・体型など）",
  "",
  "【希望する表情・雰囲気】",
  "（例: にっこり笑顔、きゅんとする感じ）",
  "",
  "【構図のイメージ】",
  "（例: 正面バストアップ、少し見上げる角度）",
  "",
  "【使用目的】",
  "（例: Xのアイコン、配信のサムネイル）",
  "",
  "【色のイメージ】",
  "（例: 淡いピンク系でふんわり）",
].join("\n");

function PortfolioCommissionFormSession({
  content,
  demoMode,
  structuredIntake,
  initialMode,
  opening,
  fromPlan,
  initialPlan,
  initialPlanLabel,
  referenceWorkTitle,
  hideHeading = false,
  onNewRequest,
  restoreOriginals,
}: {
  content: PortfolioContent;
  demoMode?: boolean;
  structuredIntake?: boolean;
  initialMode?: "consultation" | "quote";
  opening?: number;
  fromPlan?: boolean;
  initialPlan?: string;
  initialPlanLabel?: string;
  /** 「この雰囲気で相談する」から来たときの作品名。最初のフォームにだけ文面として入れておく */
  referenceWorkTitle?: string;
  hideHeading?: boolean;
  onNewRequest: (receipts: IntakeReceipt[]) => void;
  restoreOriginals: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");
  // 送信後に「新しく依頼する」で開き直したフォームには引き継がない。
  const referenceTitle = restoreOriginals ? referenceWorkTitle : undefined;
  const [autoReplied, setAutoReplied] = useState(true);
  const [completed, setCompleted] = useState<IntakeCompleted | null>(null);
  const intake = useIntakeOperation(result => {
    setCompleted(result);
    setAutoReplied(false);
    setRefImages(current => { current.forEach(entry => URL.revokeObjectURL(entry.previewUrl)); return []; });
    trackNatoriPageEvent("portfolio_form_submit", "completed");
    setStatus("success");
  }, !structuredIntake && !demoMode, fields => {
    if (fields.formVersion === "etorie-request-v1") throw new Error("saved_operation_form_changed");
    const form = legacyFormRef.current; if (!form) throw new Error("saved_operation_invalid");
    for (const field of Array.from(form.elements)) {
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) || field.type === "file") continue;
      const saved = fields[field.name];
      if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) field.checked = Array.isArray(saved) ? saved.includes(field.value) : saved === field.value;
      else if (typeof saved === "string") field.value = saved;
    }
    if (typeof fields.plan === "string") setSelectedPlan(fields.plan);
  }, restoreOriginals);
  const [selectedPlan, setSelectedPlan] = useState<string>(() => {
    const plan = content.plans.find((entry) => entry.id === initialPlan);
    return plan ? planChoiceLabel(plan) : initialPlanLabel ?? PLAN_UNDECIDED;
  });
  const [refImages, setRefImages] = useState<RefImageEntry[]>([]);
  const [refError, setRefError] = useState<string | null>(null);
  const refFileInputRef = useRef<HTMLInputElement | null>(null);
  const formStartTrackedRef = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const legacyFormRef = useRef<HTMLFormElement | null>(null);
  const [legacyMode, setLegacyMode] = useState<"consultation" | "quote">(initialMode ?? "consultation");
  const [legacyStep, setLegacyStep] = useState(0);
  const commissionOpen = content.commissionOpen;
  const [startingNewRequest, setStartingNewRequest] = useState(false);
  const [newRequestError, setNewRequestError] = useState<string | null>(null);
  const startingNewRequestRef = useRef(false);
  const newRequestLifecycleRef = useRef({ active: false, revision: 0 });
  useEffect(() => {
    const lifecycle = newRequestLifecycleRef.current; lifecycle.active = true;
    return () => { lifecycle.active = false; lifecycle.revision++; };
  }, []);
  const startNewRequest = async () => {
    if (!completed || startingNewRequestRef.current) return;
    const lifecycle = newRequestLifecycleRef.current, revision = ++lifecycle.revision;
    const isCurrent = () => lifecycle.active && lifecycle.revision === revision;
    startingNewRequestRef.current = true; setStartingNewRequest(true); setNewRequestError(null);
    try {
      const receipts = await retireCompletedIntakeOperation("natori-intake-operation-v1", completed.receipt, isCurrent);
      if (!isCurrent()) return;
      if (receipts) onNewRequest(receipts);
      else setNewRequestError("前回の受付結果を確認できませんでした。新しい依頼を始めず、受付状況を再確認してください。");
    } catch { if (!isCurrent()) return; setNewRequestError("受付番号を保管できませんでした。前回の受付情報は残しています。"); }
    finally { if (isCurrent()) { startingNewRequestRef.current = false; setStartingNewRequest(false); } }
  };

  useEffect(() => {
    if (status === "success") successHeadingRef.current?.focus();
  }, [status]);
  useEffect(() => {
    if (!opening) return;
    setLegacyMode(initialMode ?? "consultation");
    setLegacyStep(0);
  }, [opening, initialMode]);
  const legacyLastStep = legacyMode === "quote" ? 2 : 1;
  const legacyStepLabels = legacyMode === "quote"
    ? ["制作内容", "条件・連絡先", "確認・送信"]
    : ["ご相談内容", "確認・送信"];
  const legacyReview = legacyStep === legacyLastStep;
  const nextLegacyStep = () => {
    const form = legacyFormRef.current;
    if (!form) return;
    const names = legacyMode === "quote" && legacyStep === 0
      ? ["details"]
      : ["name", "email", "details"];
    for (const name of names) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        if (!field.checkValidity()) {
          field.reportValidity();
          field.focus();
          return;
        }
      }
    }
    setLegacyStep((current) => current + 1);
  };
  const tsunaguLink = commissionOpen
    ? content.socialLinks.find(isPortfolioTsunaguLink)
    : undefined;

  const planChoices = [...content.plans.map(planChoiceLabel), PLAN_UNDECIDED];

  const trackFormStart = () => {
    if (formStartTrackedRef.current) return;
    formStartTrackedRef.current = true;
    trackNatoriPageEvent("portfolio_form_start", "form");
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PortfolioPlanSelectDetail>).detail;
      if (!detail || typeof detail.label !== "string") return;
      const matchingPlan =
        detail.id === null
          ? content.plans.find(
              (plan) => plan.id === null && planChoiceLabel(plan) === detail.label
            )
          : content.plans.find((plan) => plan.id === detail.id);
      if (matchingPlan) setSelectedPlan(planChoiceLabel(matchingPlan));
    };
    window.addEventListener(PLAN_SELECT_EVENT, handler);
    return () => window.removeEventListener(PLAN_SELECT_EVENT, handler);
  }, [content.plans]);

  const handleRefFiles = (files: File[]) => {
    if (files.length === 0) return;
    const remaining = MAX_REF_IMAGES - refImages.length;
    if (remaining <= 0) {
      setRefError(`画像は最大${MAX_REF_IMAGES}枚までです。`);
      return;
    }
    const selectedFiles = files.slice(0, remaining);
    const oversized = selectedFiles.find((file) => file.size > REF_IMAGE_MAX_BYTES);
    if (oversized) {
      setRefError("1枚4MBまで（png / jpg / webp / gif）です。");
      return;
    }
    const totalBytes = [...refImages.map((entry) => entry.file), ...selectedFiles].reduce(
      (sum, file) => sum + file.size,
      0
    );
    if (totalBytes > NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES) {
      setRefError("画像の合計サイズは4MBまでです。");
      return;
    }
    setRefError(null);
    const selected = selectedFiles.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setRefImages((current) => [...current, ...selected].slice(0, MAX_REF_IMAGES));
  };

  const removeRefImage = (index: number) => {
    setRefImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending" || intake.frozen || !commissionOpen) return;
    if (legacyStep !== legacyLastStep) return;
    for (const name of ["name", "email", "details"]) {
      const field = e.currentTarget.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        if (!field.checkValidity()) {
          setLegacyStep(legacyMode === "quote" && name === "details" ? 0 : legacyLastStep - 1);
          requestAnimationFrame(() => { field.reportValidity(); field.focus(); });
          return;
        }
      }
    }
    if (demoMode) {
      setRefImages((current) => {
        current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
        return [];
      });
      setStatus("success");
      return;
    }
    setStatus("sending");

    const form = e.currentTarget;
    const data = new FormData(form);
    for (const entry of refImages) data.append("refImages", entry.file);

    try {
      await intake.submit(data, refImages.map(entry => entry.file));
    } finally {
      setStatus(current => current === "success" ? current : "idle");
    }
  };

  return (
    <section
      className={hideHeading ? "pb-5 pt-3" : "py-5"}
      style={{ background: c.page }}
      onInputCapture={trackFormStart}
      onChangeCapture={trackFormStart}
    >
      <div className="mx-auto max-w-2xl px-5">
        {!hideHeading && <h2 className="mb-2 text-center text-2xl font-black md:text-3xl">ご依頼フォーム</h2>}
        <p
          className={`${tsunaguLink ? "mb-2" : "mb-8"} text-center`}
          style={{ color: c.textSoft }}
        >
          {commissionOpen
            ? `まずはお気軽にご相談ください。${NATORI_INTAKE_COPY.notConfirmed}`
            : "現在コミッションは停止中です。再開まで今しばらくお待ちください。"}
        </p>
        {tsunaguLink ? (
          <p className="mb-8 text-center" style={{ color: c.textSoft }}>
            <a
              href={tsunaguLink.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackNatoriPageEvent("portfolio_sns_click", "つなぐ")}
              className="pf-cute-focus font-bold underline decoration-2 underline-offset-4 hover:opacity-70"
              style={{ color: c.accentText, textDecorationColor: c.accentSoft }}
            >
              つなぐ
            </a>
            からのご依頼も受付中です
          </p>
        ) : null}

        {status === "success" ? (
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: c.surface, boxShadow: `0 10px 22px ${c.shadowSoft}` }}
          >
            <p className="mb-2 text-3xl" aria-hidden="true">🎉</p>
            <h3 ref={successHeadingRef} tabIndex={-1} className="mb-1 text-lg font-bold outline-none">
              送信ありがとうございます!
            </h3>
            <p className="text-sm" style={{ color: c.textSoft }}>
              {NATORI_INTAKE_COPY.reply}{NATORI_INTAKE_COPY.next}
            </p>
            <p className="mt-2 text-xs" style={{ color: c.textSoft }}>
              {completed ? "受付確認メールは別にお送りします。メールが届かない場合も、再応募は不要です。" : autoReplied
                ? "ご入力のメールアドレス宛に受付確認メールをお送りしました。届かない場合は迷惑メールフォルダをご確認ください。"
                : "受付は完了しましたが、確認メールを送信できませんでした。2〜3日以内のご連絡をお待ちください。"}
            </p>
            <p className="mt-2 text-sm" style={{ color: c.textSoft }}>{NATORI_INTAKE_COPY.notConfirmed}</p>
            {completed && <div className="mt-4 space-y-2 text-sm">
              <p className="break-all">ご連絡先：{completed.clientEmail}</p>
              <p className="break-all">受付確認用：{completed.receipt}</p>
              <button type="button" disabled={startingNewRequest || !commissionOpen} onClick={() => void startNewRequest()} className="pf-cute-focus min-h-11 rounded-full border-2 px-4 font-bold">新しい依頼を始める</button>
              {newRequestError && <p role="alert">{newRequestError}</p>}
              <p>迷惑メールフォルダもご確認ください。2〜3日を過ぎても連絡がない場合は、公開連絡先へお問い合わせください。</p>
              <p>保存済みの依頼として確認できます。新しく応募し直す必要はありません。</p>
              {content.socialLinks.find(link => link.label === "X") && <a className="pf-cute-focus min-h-11 inline-flex items-center underline" href={content.socialLinks.find(link => link.label === "X")?.href} target="_blank" rel="noopener noreferrer">公開連絡先（X）</a>}
            </div>}
          </div>
        ) : structuredIntake ? (
          <div className="space-y-4">
          <PortfolioStructuredCommissionForm
              content={content}
              restoreOriginals={restoreOriginals}
              demoMode={demoMode}
              commissionOpen={commissionOpen}
              initialMode={initialMode}
              opening={opening}
              fromPlan={fromPlan}
              initialPlan={initialPlan}
              initialMessage={
                referenceTitle !== undefined ? portfolioWorkConsultationMessage(referenceTitle) : undefined
              }
              onSuccess={(outcome) => {
                if (outcome.receipt) setCompleted({ receipt: outcome.receipt, clientEmail: outcome.clientEmail ?? "" });
                setAutoReplied(outcome.autoReplied);
                setStatus("success");
              }}
            />
          </div>
        ) : (
          <form
            ref={legacyFormRef}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5 rounded-2xl p-6 md:p-8"
            style={{ background: c.surface, boxShadow: `0 10px 22px ${c.shadowSoft}` }}
          >
            {/* form の space-y-5 は display:contents の fieldset の中まで届かないので、行の間隔はここで付ける */}
            <fieldset className="contents space-y-5" disabled={intake.frozen || status === "sending"}>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-2 text-sm" role="group" aria-label="お問い合わせの種類" style={{ borderColor: c.borderSubtle }}>
              <span className="text-xs font-bold" style={{ color: c.textSoft }}>ご希望</span>
              {(["consultation", "quote"] as const).map((choice) => (
                <button key={choice} type="button" aria-pressed={legacyMode === choice}
                  onClick={() => { setLegacyMode(choice); setLegacyStep(0); }}
                  className="pf-cute-focus min-h-11 border-b-2 px-1 text-sm font-bold"
                  style={{ borderColor: legacyMode === choice ? c.accentText : "transparent", color: legacyMode === choice ? c.accentText : c.textSoft }}>
                  {choice === "consultation" ? "まず相談したい" : "見積もりを希望"}
                </button>
              ))}
            </div>
            <p className="text-sm font-bold" aria-live="polite">
              ステップ {legacyStep + 1} / {legacyStepLabels.length}
              <span className="ml-2">{legacyStepLabels[legacyStep]}</span>
            </p>
            <ol className="flex gap-2" aria-label={`進行状況 ${legacyStep + 1} / ${legacyStepLabels.length}`}>
              {legacyStepLabels.map((label, index) => (
                <li key={label} className="min-w-0 flex-1" aria-current={index === legacyStep ? "step" : undefined}>
                  <span className="block h-1 rounded-full" style={{ background: index <= legacyStep ? c.accentText : c.borderSubtle }} />
                  <span className="mt-2 block text-center text-[11px] font-bold leading-tight sm:text-xs" style={{ color: index === legacyStep ? c.accentText : c.textSoft }}>{label}</span>
                </li>
              ))}
            </ol>

            {/* Tailwind の .grid は hidden 属性より強いので、grid は表示中の行だけに付ける */}
            <div hidden={legacyReview || (legacyMode === "quote" && legacyStep === 0)} className="gap-5 sm:grid-cols-2 [&:not([hidden])]:grid">
              <div>
                <label htmlFor="pf-name" className={labelClass}>
                  お名前（活動名でOK）<span style={{ color: c.error }}>＊</span>
                </label>
                <input
                  id="pf-name"
                  name="name"
                  required
                  maxLength={100}
                  className={inputClass}
                  style={{ borderColor: c.formBorder }}
                />
              </div>
              <div>
                <label htmlFor="pf-email" className={labelClass}>
                  メールアドレス<span style={{ color: c.error }}>＊</span>
                </label>
                <input
                  id="pf-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  className={inputClass}
                  style={{ borderColor: c.formBorder }}
                />
              </div>
            </div>

            <div hidden={legacyMode !== "quote" || legacyStep !== 0} className="gap-5 sm:grid-cols-2 [&:not([hidden])]:grid">
              <div>
                <label htmlFor="pf-type" className={labelClass}>ご依頼の種類</label>
                <select
                  id="pf-type"
                  name="requestType"
                  className={inputClass}
                  style={{ borderColor: c.formBorder }}
                >
                  {content.services.map((service) => <option key={service}>{service}</option>)}
                  <option>{REQUEST_TYPE_OTHER}</option>
                </select>
              </div>
              <div>
                <label htmlFor="pf-plan" className={labelClass}>サイズ / プラン</label>
                <select
                  id="pf-plan"
                  name="plan"
                  value={selectedPlan}
                  onChange={(event) => setSelectedPlan(event.target.value)}
                  className={inputClass}
                  style={{ borderColor: c.formBorder }}
                >
                  {planChoices.map((plan) => <option key={plan}>{plan}</option>)}
                </select>
              </div>
            </div>

            <fieldset hidden={legacyMode !== "quote" || legacyStep !== 0}>
              <legend className={labelClass}>追加オプション（複数選択可）</legend>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {content.options.map((option, index) => (
                  <label
                    key={option.id ?? `legacy-option-${index}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                    style={{ color: c.textSoft }}
                  >
                    <input
                      type="checkbox"
                      name="options"
                      value={`${option.name}（${option.price}）`}
                      data-option-id={option.id ?? undefined}
                      className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0"
                    />
                    <span>
                      {option.name}
                      <span className="ml-1 text-xs font-bold" style={{ color: c.accentText }}>
                        {option.price}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div hidden={legacyMode !== "quote" || legacyStep !== 1} className="gap-5 sm:grid-cols-2 [&:not([hidden])]:grid">
              <div>
                <label htmlFor="pf-budget" className={labelClass}>ご予算</label>
                <select
                  id="pf-budget"
                  name="budget"
                  className={inputClass}
                  style={{ borderColor: c.formBorder }}
                >
                  {portfolioBudgetOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="pf-deadline" className={labelClass}>希望納期</label>
                <select
                  id="pf-deadline"
                  name="deadline"
                  className={inputClass}
                  style={{ borderColor: c.formBorder }}
                >
                  {portfolioDeadlineOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>

            <div hidden={legacyReview || (legacyMode === "quote" && legacyStep !== 0)}>
              <span className={labelClass}>キャラクター資料（画像添付）</span>
              <p className="mb-2 text-xs" style={{ color: c.textSoft }}>
                キャラクターの設定画・立ち絵・過去のイラストなどを添付してください（最大
                {MAX_REF_IMAGES}枚・合計4MBまで）。URLで共有したい資料は「ご依頼の詳細」に貼ってOKです。
              </p>
              {refImages.length > 0 ? (
                <ul className="mb-3 flex flex-wrap gap-3">
                  {refImages.map((entry, index) => (
                    <li key={entry.previewUrl} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.previewUrl}
                        alt={`添付画像 ${index + 1}`}
                        className="h-20 w-20 rounded-lg border-2 object-cover"
                        style={{ borderColor: c.formBorder }}
                      />
                      <button
                        type="button"
                        onClick={() => removeRefImage(index)}
                        className="pf-cute-focus absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white shadow"
                        style={{ background: c.error, color: c.onError }}
                        aria-label={`添付画像 ${index + 1} を外す`}
                        title="この画像を外す"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {refImages.length < MAX_REF_IMAGES ? (
                <button
                  type="button"
                  onClick={() => refFileInputRef.current?.click()}
                  className="pf-cute-focus inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
                  style={{ borderColor: c.formBorderActive, color: c.formBorderActive }}
                >
                  ＋ 画像を追加
                </button>
              ) : null}
              {refError ? (
                <p className="mt-2 text-xs font-bold" style={{ color: c.error }} role="alert">{refError}</p>
              ) : null}
              <input
                ref={refFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  event.target.value = "";
                  handleRefFiles(files);
                }}
              />
            </div>

            <div hidden={legacyReview || (legacyMode === "quote" && legacyStep !== 0)}>
              <label htmlFor="pf-details" className={labelClass}>
                ご依頼の詳細<span style={{ color: c.error }}>＊</span>
              </label>
              <p className="mb-2 text-xs" style={{ color: c.textSoft }}>
                テンプレートの各項目に追記してください。わかる範囲でOK、不要な項目は消してかまいません。
              </p>
              <textarea
                id="pf-details"
                name="details"
                rows={16}
                required
                maxLength={4000}
                defaultValue={
                  referenceTitle !== undefined
                    ? withPortfolioConsultationWork(DETAILS_TEMPLATE, referenceTitle)
                    : DETAILS_TEMPLATE
                }
                className={inputClass}
                style={{ borderColor: c.formBorder }}
              />
            </div>

            <div hidden={legacyReview || (legacyMode === "quote" && legacyStep !== 1)}>
              <label htmlFor="pf-message" className={labelClass}>その他・ご質問</label>
              <textarea
                id="pf-message"
                name="message"
                rows={3}
                maxLength={2000}
                placeholder="納期のご相談・非公開希望・そのほか気になることがあればどうぞ"
                className={inputClass}
                style={{ borderColor: c.formBorder }}
              />
            </div>

            {legacyReview && (
              <div className="space-y-2 rounded-xl p-4 text-sm" style={{ background: c.page }}>
                <p><strong>お名前：</strong>{legacyFormRef.current?.elements.namedItem("name") instanceof HTMLInputElement ? (legacyFormRef.current.elements.namedItem("name") as HTMLInputElement).value : ""}</p>
                <p><strong>メール：</strong>{legacyFormRef.current?.elements.namedItem("email") instanceof HTMLInputElement ? (legacyFormRef.current.elements.namedItem("email") as HTMLInputElement).value : ""}</p>
                {legacyMode === "quote" && <p><strong>プラン：</strong>{selectedPlan}</p>}
                <p><strong>内容：</strong>{legacyFormRef.current?.elements.namedItem("details") instanceof HTMLTextAreaElement ? (legacyFormRef.current.elements.namedItem("details") as HTMLTextAreaElement).value : ""}</p>
                {refImages.length > 0 && <p><strong>添付画像：</strong>{refImages.map((entry) => entry.file.name).join("、")}</p>}
              </div>
            )}

            {status === "error" ? (
              <p
                className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
                style={{ borderColor: c.error, color: c.error, background: c.errorSoft }}
                role="alert"
              >
                送信結果を確認できませんでした。下の確認ボタンで同じ送信の結果を確認できます。
              </p>
            ) : null}

            {legacyReview && <PortfolioLegalNotice />}
            {legacyStep > 0 && <button type="button" onClick={() => setLegacyStep((step) => step - 1)} className="pf-cute-focus rounded-full border px-5 py-2 text-sm font-bold">戻る</button>}
            {legacyReview ? <button
              key="legacy-submit"
              type="submit"
              disabled={!commissionOpen || status === "sending"}
              className={`${natoriPrimaryActionClassName} pf-cute-focus w-full rounded-full border-2 py-3.5 text-base font-black`}
            >
              {!commissionOpen
                ? "現在受付停止中です"
                : status === "sending"
                  ? "送信中…"
                  : "この内容で送信する"}
            </button> : <button key="legacy-next" type="button" onClick={(event) => { event.preventDefault(); nextLegacyStep(); }} disabled={!commissionOpen} className={`${natoriPrimaryActionClassName} pf-cute-focus w-full rounded-full border-2 py-3.5 text-base font-black`}>次へ進む</button>}

            </fieldset>
            <IntakeRecoveryPanel intake={intake} />
          </form>
        )}
      </div>
    </section>
  );
}


/** A confirmed explicit new request remounts both form variants, including controlled fields and File objects. */
export default function PortfolioCommissionForm(props: Omit<Parameters<typeof PortfolioCommissionFormSession>[0], "onNewRequest" | "restoreOriginals">) {
  const [session, setSession] = useState(0);
  const [receipts, setReceipts] = useState<IntakeReceipt[]>([]);
  useEffect(() => { try { setReceipts(loadIntakeReceipts()); } catch { /* Existing active recovery stays authoritative. */ } }, []);
  return <>
    <PortfolioCommissionFormSession key={session} {...props} restoreOriginals={session === 0} onNewRequest={history => {
      setReceipts(history); setSession(current => current + 1);
    }} />
    {receipts.length > 0 && <aside aria-label="これまでの受付確認" className="mx-auto max-w-2xl space-y-2 px-5 pb-5 text-sm">
      <p className="font-bold">これまでの受付確認</p>
      {receipts.map(receipt => <p key={receipt.receipt} className="break-all">受付番号：{receipt.receipt}　連絡先：{receipt.clientEmail}</p>)}
    </aside>}
  </>;
}
