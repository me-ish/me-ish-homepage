"use client";

// features/natori/components/portfolio/PortfolioStructuredCommissionForm.tsx
// P1-06 の構造化ご依頼フォーム本体。入力 state → RequestData V1 の変換は
// features/natori/lib/portfolioRequestForm.ts（共有純関数）に集約し、
// UI 独自の payload 形は作らない。client / server は同じ共有 schema で検証する。
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  PLAN_SELECT_EVENT,
  isPortfolioXLink,
  PORTFOLIO_OPTION_IDS,
  type PortfolioPlanSelectDetail,
} from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import { MASS_PRODUCTION_COMMERCIAL_AMOUNT, MASS_PRODUCTION_VARIANTS } from "@/features/natori/constants/massProductionIllustration";
import {
  NATORI_MAX_REFERENCE_IMAGES,
  NATORI_MAX_REFERENCE_LINKS,
  NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE,
  NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES,
  NATORI_REFERENCE_IMAGE_MAX_BYTES,
  NATORI_STRUCTURED_FORM_VERSION,
  applyPortfolioRequestTypeSelection,
  applyPortfolioPlanSelection,
  buildNatoriRequestDataV1,
  collectPortfolioReferenceLinkErrors,
  createInitialPortfolioRequestFormState,
  isMassProductionIllustrationSelection,
  massProductionOptionChoices,
  portfolioOptionAllowsQuantity,
  portfolioOptionChoices,
  portfolioRequestTypeChoiceValue,
  pruneHiddenPortfolioRequestFields,
  submittedPortfolioReferenceLinks,
  type PortfolioRequestTypeChoiceValue,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import { natoriRequestSubmissionV1Schema } from "@/features/natori/lib/requestSchema";
import {
  portfolioErrorTarget,
  portfolioRetryAfterSeconds,
  portfolioValidationMessage,
} from "@/features/natori/lib/portfolioFormFeedback";
import {
  NATORI_BUDGET_KIND_LABELS_V1,
  NATORI_COMMERCIAL_USE_LABELS_V1,
  NATORI_COMMISSION_SCOPE_LABELS_V1,
  NATORI_DEADLINE_KIND_LABELS_V1,
  NATORI_INQUIRY_MODE_LABELS_V1,
  NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL,
  NATORI_PUBLICATION_POLICY_LABELS_V1,
  NATORI_REQUEST_TYPE_LABELS_V1,
  NATORI_USAGE_TYPE_LABELS_V1,
} from "@/features/natori/lib/requestPresentation";
import {
  NATORI_COMMISSION_SCOPES_V1,
  NATORI_REQUEST_TYPES_V1,
  NATORI_USAGE_TYPES_V1,
  type NatoriBudgetV1,
  type NatoriDeadlineV1,
  type NatoriInquiryModeV1,
  type NatoriUsageTypeV1,
} from "@/features/natori/types/request";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { CSRF_HEADERS } from "@/lib/auth/csrf";
import PortfolioLegalNotice from "./PortfolioLegalNotice";
import PortfolioFormStyles, { portfolioFormColors as c } from "./PortfolioFormStyles";

const inputClass = "pf-cute-focus pf-form-control w-full rounded-lg border-2 px-3 py-2";
const labelClass = "mb-1.5 block text-sm font-bold";
const optionalBadgeClass = "ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold";

type RefImageEntry = { file: File; previewUrl: string };
type ServerFieldError = { path: string; message: string };

export type StructuredSubmitOutcome = { autoReplied: boolean };

function OptionalBadge() {
  return (
    <span
      className={optionalBadgeClass}
      style={{ background: c.surfaceSubtle, color: c.textSoft }}
    >
      任意
    </span>
  );
}

function RequiredBadge() {
  return (
    <span
      className={optionalBadgeClass}
      style={{ background: c.errorSoft, color: c.error }}
    >
      必須
    </span>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 text-xs font-bold"
      style={{ color: c.error }}
    >
      {message}
    </p>
  );
}

/** 折りたたみ可能な入力セクション。閉じていても DOM には残す。 */
function FormSection({
  title,
  description,
  summary,
  collapsible,
  required,
  open,
  onToggle,
  children,
}: {
  title: string;
  description?: string;
  summary?: string;
  collapsible?: boolean;
  required?: boolean;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  children: ReactNode;
}) {
  if (!collapsible) {
    return (
      <section className="rounded-xl border p-4" style={{ borderColor: c.borderSubtle }}>
        <h3 className="mb-3 flex items-center text-base font-black">{title}</h3>
        {description ? (
          <p className="mb-3 text-sm leading-relaxed" style={{ color: c.textSoft }}>
            {description}
          </p>
        ) : null}
        <div className="space-y-4">{children}</div>
      </section>
    );
  }

  return (
    <details
      className="group/section rounded-xl border p-4"
      style={{ borderColor: c.borderSubtle }}
      open={open}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary className="pf-cute-focus flex min-h-[44px] cursor-pointer list-none items-center text-base font-black [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          {title}{required ? <RequiredBadge /> : <OptionalBadge />}
          {summary ? <span className="mt-1 block text-sm font-normal" style={{ color: c.textSoft }}>{summary}</span> : null}
        </span>
        <span aria-hidden="true" className="ml-auto group-open/section:rotate-180">⌄</span>
      </summary>
      {description ? (
        <p className="mt-3 text-sm leading-relaxed" style={{ color: c.textSoft }}>
          {description}
        </p>
      ) : null}
      <div className="mt-3 space-y-4">{children}</div>
    </details>
  );
}

export default function PortfolioStructuredCommissionForm({
  content,
  demoMode,
  commissionOpen,
  onSuccess,
}: {
  content: PortfolioContent;
  demoMode?: boolean;
  commissionOpen: boolean;
  onSuccess: (outcome: StructuredSubmitOutcome) => void;
}) {
  const [state, setState] = useState<PortfolioRequestFormState>(
    createInitialPortfolioRequestFormState
  );
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<ServerFieldError[]>([]);
  const [refImages, setRefImages] = useState<RefImageEntry[]>([]);
  const [refImageError, setRefImageError] = useState<string | null>(null);
  const [massProductionNotice, setMassProductionNotice] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    requestType: false,
    usage: false,
    budget: false,
    materials: false,
  });
  const refFileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const sendingRef = useRef(false);
  const [focusTarget, setFocusTarget] = useState<{ id: string } | null>(null);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const retryUntilRef = useRef(0);
  const waitingToRetry = retrySeconds > 0;

  useEffect(() => {
    if (!waitingToRetry) return;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((retryUntilRef.current - Date.now()) / 1000));
      setRetrySeconds(remaining);
      if (remaining === 0) setSubmitError("再送できるようになりました。入力内容をご確認のうえ送信してください。");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [waitingToRetry]);

  useEffect(() => {
    if (!focusTarget) return;
    const target = document.getElementById(focusTarget.id);
    const fallback = document.getElementById("pf-submit-errors");
    if (target && formRef.current?.contains(target)) target.focus();
    else fallback?.focus();
  }, [focusTarget]);

  const linkErrors = collectPortfolioReferenceLinkErrors(state.referenceLinks);
  const massProductionSelected = isMassProductionIllustrationSelection(state);
  const optionChoices = useMemo(
    () => massProductionSelected ? massProductionOptionChoices() : portfolioOptionChoices(content),
    [content, massProductionSelected],
  );
  const requestTypeChoice = portfolioRequestTypeChoiceValue(state);
  const xLink = content.socialLinks.find(isPortfolioXLink);
  const hasOtherDetails = [state.characterFeatures, state.expressionMood, state.composition,
    state.colorDirection, state.referenceNotes].some((value) => value.trim().length > 0);
  const messageRequired = state.inquiryMode === "consultation" && !hasOtherDetails;
  const commercialPrice = content.options.find((option) => option.id === PORTFOLIO_OPTION_IDS.commercialUse)?.price;
  const publicationOptions = content.options.filter((option) =>
    option.id === PORTFOLIO_OPTION_IDS.sampleUsageDenied || option.id === PORTFOLIO_OPTION_IDS.privateWork
  );

  const openErrorSections = (errors: ServerFieldError[]) => {
    const sections = errors.map((error) => portfolioErrorTarget(error.path, state, optionChoices).section);
    if (sections.some(Boolean)) setOptionalOpen(true);
    if (sections.includes("details")) setDetailsOpen(true);
    setOpenSections((current) => ({
      requestType: current.requestType || sections.includes("requestType"),
      usage: current.usage || sections.includes("usage"),
      budget: current.budget || sections.includes("budget"),
      materials: current.materials || sections.includes("materials"),
    }));
  };

  const focusError = (error: ServerFieldError) => {
    openErrorSections([error]);
    setFocusTarget({ id: portfolioErrorTarget(error.path, state, optionChoices).id });
  };

  const showFieldErrors = (errors: ServerFieldError[]) => {
    setServerFieldErrors(errors);
    setSubmitError("入力内容をご確認ください。下の項目から修正箇所へ移動できます。");
    openErrorSections(errors);
    if (errors[0]) focusError(errors[0]);
  };

  const errorAttributes = (id: string, description?: string) => {
    const index = serverFieldErrors.findIndex((error) => portfolioErrorTarget(error.path, state, optionChoices).id === id);
    return {
      "aria-invalid": index >= 0 ? true : undefined,
      "aria-describedby": [description, index >= 0 ? `pf-submit-error-${index}` : null].filter(Boolean).join(" ") || undefined,
    };
  };

  const update = (patch: Partial<PortfolioRequestFormState>) =>
    setState((current) => pruneHiddenPortfolioRequestFields({ ...current, ...patch }));

  const changeRequestType = (value: PortfolioRequestTypeChoiceValue) => {
    if (
      value === NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE &&
      !content.massProductionIllustrationOpen
    ) {
      setMassProductionNotice(true);
      return;
    }
    setMassProductionNotice(false);
    setState((current) => applyPortfolioRequestTypeSelection(current, value));
    if (value === NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE) {
      setOptionalOpen(true);
      setOpenSections({ requestType: true, usage: false, budget: false, materials: false });
      setDetailsOpen(false);
    }
  };

  /** モード切替で任意セクションの開閉だけを変える。残留値は prune で落とす。 */
  const changeMode = (inquiryMode: NatoriInquiryModeV1) => {
    if (inquiryMode === state.inquiryMode) return;
    trackNatoriPageEvent("portfolio_form_mode_select", inquiryMode);
    update({ inquiryMode });
    const expanded = inquiryMode === "quote";
    setOpenSections((current) => ({ ...current, requestType: expanded || current.requestType }));
    setOptionalOpen(expanded);
  };

  // 料金カードの「このプランで相談」からプランを受け取る
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PortfolioPlanSelectDetail>).detail;
      if (!detail) return;
      setState((current) => applyPortfolioPlanSelection(current, detail.id));
      setOptionalOpen(true);
      setOpenSections((current) => ({ ...current, requestType: true }));
    };
    window.addEventListener(PLAN_SELECT_EVENT, handler);
    return () => window.removeEventListener(PLAN_SELECT_EVENT, handler);
  }, []);

  const serverErrorFor = (path: string) =>
    serverFieldErrors.find((error) => error.path === path)?.message;

  const toggleUsageType = (usage: NatoriUsageTypeV1) => {
    setState((current) => {
      const next = current.usageTypes.includes(usage)
        ? current.usageTypes.filter((item) => item !== usage)
        : [...current.usageTypes, usage];
      return pruneHiddenPortfolioRequestFields({ ...current, usageTypes: next });
    });
  };

  const setOptionSelection = (
    key: string,
    patch: Partial<{ selected: boolean; quantity: number; notes: string }>
  ) => {
    setState((current) => {
      const previous = current.optionSelections[key] ?? {
        selected: false,
        quantity: 1,
        notes: "",
      };
      return {
        ...current,
        optionSelections: {
          ...current.optionSelections,
          [key]: { ...previous, ...patch },
        },
      };
    });
  };

  const setReferenceLink = (index: number, patch: Partial<{ url: string; label: string }>) => {
    setState((current) => ({
      ...current,
      referenceLinks: current.referenceLinks.map((row, i) =>
        i === index ? { ...row, ...patch } : row
      ),
    }));
  };

  const addReferenceLinkRow = () => {
    setState((current) =>
      current.referenceLinks.length >= NATORI_MAX_REFERENCE_LINKS
        ? current
        : { ...current, referenceLinks: [...current.referenceLinks, { url: "", label: "" }] }
    );
  };

  const removeReferenceLinkRow = (index: number) => {
    setState((current) => {
      const next = current.referenceLinks.filter((_, i) => i !== index);
      return { ...current, referenceLinks: next.length > 0 ? next : [{ url: "", label: "" }] };
    });
  };

  const handleRefFiles = (files: File[]) => {
    if (files.length === 0) return;
    const remaining = NATORI_MAX_REFERENCE_IMAGES - refImages.length;
    if (remaining <= 0) {
      setRefImageError(`画像は最大${NATORI_MAX_REFERENCE_IMAGES}枚までです。`);
      return;
    }
    if (files.some((file) => file.size > NATORI_REFERENCE_IMAGE_MAX_BYTES)) {
      setRefImageError("1枚10MBまで（png / jpg / webp / gif）です。");
      return;
    }
    const selected = files.slice(0, remaining);
    const nextTotal = [...refImages.map((entry) => entry.file), ...selected].reduce(
      (sum, file) => sum + file.size,
      0
    );
    if (nextTotal > NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES) {
      setRefImageError("画像の合計サイズが10MBを超えています。");
      return;
    }
    setRefImageError(null);
    setRefImages((current) =>
      [
        ...current,
        ...selected.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
      ].slice(0, NATORI_MAX_REFERENCE_IMAGES)
    );
  };

  const removeRefImage = (index: number) => {
    setRefImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  };

  const releasePreviews = () => {
    setRefImages((current) => {
      current.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
      return [];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 二重 submit 防止。state 更新前の連打も ref で塞ぐ。
    if (sendingRef.current || retrySeconds > 0) return;
    const form = event.currentTarget;
    const payload = new FormData(form);
    const parsed = natoriRequestSubmissionV1Schema.safeParse({
      clientName: String(payload.get("name") ?? ""),
      clientEmail: String(payload.get("email") ?? ""),
      requestData: buildNatoriRequestDataV1(state, optionChoices),
    });
    const errors: ServerFieldError[] = parsed.success ? [] : parsed.error.issues.map((issue) => ({
      path: issue.path.join("."), message: portfolioValidationMessage(issue),
    }));
    errors.push(...linkErrors.map((error) => ({ path: `referenceLinks.${error.index}.url`, message: error.message })));
    if (errors.length > 0) {
      showFieldErrors(errors);
      return;
    }
    if (!parsed.success) return;
    const requestData = parsed.data.requestData;

    if (demoMode) {
      releasePreviews();
      onSuccess({ autoReplied: true });
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setSubmitError(null);
    setServerFieldErrors([]);

    // honeypot を含む素の入力は FormData から拾い、構造化値は明示的に足す。
    payload.set("formVersion", NATORI_STRUCTURED_FORM_VERSION);
    payload.set("requestData", JSON.stringify(requestData));
    payload.set(
      "referenceLinks",
      JSON.stringify(submittedPortfolioReferenceLinks(state.referenceLinks))
    );
    for (const entry of refImages) payload.append("refImages", entry.file);

    try {
      const res = await fetch("/api/natori/portfolio/contact", {
        method: "POST",
        headers: { ...CSRF_HEADERS },
        body: payload,
      });
      const response = (await res.json().catch(() => null)) as
        | { autoReplied?: boolean; fields?: ServerFieldError[]; error?: string }
        | null;

      if (!res.ok) {
        if (res.status === 429) {
          const seconds = portfolioRetryAfterSeconds(res.headers?.get("Retry-After") ?? null);
          retryUntilRef.current = Date.now() + (seconds ?? 0) * 1000;
          setRetrySeconds(seconds ?? 0);
          setSubmitError(seconds !== null && seconds > 0
            ? `送信回数の上限に達しました。約${Math.ceil(seconds / 60)}分後に再送できます。入力内容は保持しています。`
            : "送信回数の上限に達しました。時間をおいて再度お試しください。入力内容は保持しています。");
          setFocusTarget({ id: "pf-submit-errors" });
          return;
        }
        if (Array.isArray(response?.fields) && response.fields.length > 0) {
          // API の参照URLの添字は空行を除いた送信配列に対応する。
          const rowIndices = state.referenceLinks.flatMap((row, index) => row.url.trim() ? [index] : []);
          showFieldErrors(response.fields.map((error) => ({
            ...error,
            path: error.path.replace(/^referenceLinks\.(\d+)/, (_, index: string) =>
              `referenceLinks.${rowIndices[Number(index)] ?? index}`),
          })));
          return;
        }
        setSubmitError(
          response?.error === "invalid_request"
            ? "入力内容をご確認ください。"
            : "送信に失敗しました。時間をおいて再度お試しいただくか、SNSのDMからご連絡ください。"
        );
        setFocusTarget({ id: "pf-submit-errors" });
        return;
      }

      trackNatoriPageEvent("portfolio_form_submit", requestData.requestType);
      releasePreviews();
      onSuccess({ autoReplied: response?.autoReplied === true });
    } catch (err) {
      console.error("[portfolio-form] submit failed", err);
      setSubmitError(
        "送信に失敗しました。時間をおいて再度お試しいただくか、SNSのDMからご連絡ください。"
      );
      setFocusTarget({ id: "pf-submit-errors" });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const budgetKinds: NatoriBudgetV1["kind"][] = ["undecided", "range", "fixed"];
  const deadlineKinds: NatoriDeadlineV1["kind"][] = [
    "undecided",
    "standard",
    "preferred_date",
    "rush_consultation",
  ];

  const messageSection = (
    <FormSection key="message" title="ご相談・ご依頼の内容">
        <div>
          <label htmlFor="pf-message" className={labelClass}>
            ご相談・ご依頼の内容{messageRequired ? <RequiredBadge /> : <OptionalBadge />}
          </label>
          <textarea
            id="pf-message"
            {...errorAttributes("pf-message")}
            required={messageRequired}
            rows={4}
            maxLength={2000}
            value={state.message}
            onChange={(event) => update({ message: event.target.value })}
            placeholder="描いてほしいもの、気になっていること、ご相談したいことをご記入ください。"
            className={inputClass}
            aria-describedby={
              serverErrorFor("requestData.message") ? "pf-message-error" : undefined
            }
          />
          <FieldError id="pf-message-error" message={serverErrorFor("requestData.message")} />
          <p className="mt-2 text-sm" style={{ color: c.textSoft }}>
            決まっている範囲だけで大丈夫です。詳しい条件は下の欄から追加できます。
          </p>
        </div>
      </FormSection>
  );

  const optionalSection = (
    <details key="optional"
        open={optionalOpen}
        onToggle={(event) => setOptionalOpen(event.currentTarget.open)}
        className="group/optional rounded-xl border p-4"
        style={{ borderColor: c.borderSubtle }}
      >
        <summary className="pf-cute-focus flex min-h-[44px] cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
          {massProductionSelected ? <>量産イラストの依頼内容<RequiredBadge /></> : <>詳しい条件を追加する<OptionalBadge /></>}
          <span aria-hidden="true" className="ml-auto group-open/optional:rotate-180">⌄</span>
        </summary>
        <p className="mt-2 text-sm" style={{ color: c.textSoft }}>
          {massProductionSelected ? "デザインと表情指定は必須です。必要な追加オプションを選択してください。" : "決まっている項目だけでOKです。"}
        </p>
        <div className="mt-4 space-y-4">
          <FormSection
            title="依頼の種類"
            summary={state.requestType !== "undecided" || state.commissionScope !== "undecided"
              ? [massProductionSelected ? NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL : NATORI_REQUEST_TYPE_LABELS_V1[state.requestType],
                massProductionSelected ? state.commissionScopeOther : NATORI_COMMISSION_SCOPE_LABELS_V1[state.commissionScope]].filter(Boolean).join("／")
              : undefined}
            description={massProductionSelected ? "「おばけ」か「魔女」を選び、ご希望の表情をご記入ください。" : "作るもの（立ち絵・一枚絵など）と、人物を描く範囲（胸上・全身など）を選べます。未定のままでも相談できます。"}
            collapsible
            required={massProductionSelected}
            open={openSections.requestType}
            onToggle={(next) => setOpenSections((current) => ({ ...current, requestType: next }))}
          >
            <div className="grid gap-4">
              <div>
                <label htmlFor="pf-request-type" className={labelClass}>
                  ご依頼の種類
                </label>
                <select
                  id="pf-request-type"
                  {...errorAttributes("pf-request-type")}
                  value={requestTypeChoice}
                  onChange={(event) =>
                    changeRequestType(event.target.value as PortfolioRequestTypeChoiceValue)
                  }
                  className={inputClass}
                  aria-describedby={massProductionNotice ? "pf-mass-production-notice" : undefined}
                >
                  {NATORI_REQUEST_TYPES_V1.filter((type) => type !== "other").map((type) => (
                    <option key={type} value={type}>
                      {NATORI_REQUEST_TYPE_LABELS_V1[type]}
                    </option>
                  ))}
                  <option value={NATORI_MASS_PRODUCTION_ILLUSTRATION_VALUE}>
                    {NATORI_MASS_PRODUCTION_ILLUSTRATION_LABEL}
                  </option>
                  <option value="other">{NATORI_REQUEST_TYPE_LABELS_V1.other}</option>
                </select>
                {massProductionNotice ? (
                  <div
                    id="pf-mass-production-notice"
                    role="alert"
                    className="mt-2 rounded-lg border-2 px-3 py-2 text-sm font-bold"
                    style={{
                      borderColor: c.formBorder,
                      background: c.surfaceSubtle,
                      color: c.text,
                    }}
                  >
                    現在、量産イラストは受け付けていません。再開・詳細は
                    {xLink ? (
                      <a
                        href={xLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pf-cute-focus mx-1 underline decoration-2 underline-offset-4 hover:opacity-70"
                        style={{ color: c.formBorderActive }}
                      >
                        X
                      </a>
                    ) : (
                      "X"
                    )}
                    をご確認ください。
                  </div>
                ) : null}
              </div>
              {!massProductionSelected ? (
              <div>
                <label htmlFor="pf-scope" className={labelClass}>
                  制作範囲
                </label>
                <select
                  id="pf-scope"
                  {...errorAttributes("pf-scope")}
                  value={state.commissionScope}
                  onChange={(event) =>
                    update({ commissionScope: event.target.value as typeof state.commissionScope })
                  }
                  disabled={massProductionSelected}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-70`}
                >
                  {NATORI_COMMISSION_SCOPES_V1.map((scope) => (
                    <option key={scope} value={scope}>
                      {NATORI_COMMISSION_SCOPE_LABELS_V1[scope]}
                    </option>
                  ))}
                </select>
              </div>
              ) : null}
            </div>

            {state.requestType === "other" && !massProductionSelected ? (
              <div>
                <label htmlFor="pf-request-type-other" className={labelClass}>
                  ご依頼の種類（その他の内容）<RequiredBadge />
                </label>
                <input
                  id="pf-request-type-other"
                  {...errorAttributes("pf-request-type-other")}
                  required
                  value={state.requestTypeOther}
                  onChange={(event) => update({ requestTypeOther: event.target.value })}
                  maxLength={100}
                  className={inputClass}
                  aria-describedby={
                    serverErrorFor("requestData.requestTypeOther")
                      ? "pf-request-type-other-error"
                      : undefined
                  }
                />
                <FieldError
                  id="pf-request-type-other-error"
                  message={serverErrorFor("requestData.requestTypeOther")}
                />
              </div>
            ) : null}

            {state.commissionScope === "other" ? (
              <div>
                <label htmlFor="pf-scope-other" className={labelClass}>
                  {massProductionSelected ? "デザイン" : "制作範囲（その他の内容）"}<RequiredBadge />
                </label>
                {massProductionSelected ? (
                  <select
                    id="pf-scope-other"
                    {...errorAttributes("pf-scope-other")}
                    required
                    value={state.commissionScopeOther}
                    onChange={(event) => update({ commissionScopeOther: event.target.value })}
                    className={inputClass}
                    aria-describedby={serverErrorFor("requestData.commissionScopeOther") ? "pf-scope-other-error" : undefined}
                  >
                    <option value="">デザインを選択してください</option>
                    {MASS_PRODUCTION_VARIANTS.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
                  </select>
                ) : (
                  <input
                    id="pf-scope-other"
                    {...errorAttributes("pf-scope-other")}
                    required
                    value={state.commissionScopeOther}
                    onChange={(event) => update({ commissionScopeOther: event.target.value })}
                    maxLength={100}
                    className={inputClass}
                    aria-describedby={serverErrorFor("requestData.commissionScopeOther") ? "pf-scope-other-error" : undefined}
                  />
                )}
                <FieldError
                  id="pf-scope-other-error"
                  message={serverErrorFor("requestData.commissionScopeOther")}
                />
              </div>
            ) : null}

            {massProductionSelected ? (
              <div>
                <label htmlFor="pf-mass-expression" className={labelClass}>表情指定<RequiredBadge /></label>
                <textarea
                  id="pf-mass-expression"
                  {...errorAttributes("pf-mass-expression")}
                  required
                  rows={3}
                  maxLength={1000}
                  value={state.expressionMood}
                  onChange={(event) => update({ expressionMood: event.target.value })}
                  placeholder="例：口を開けた笑顔。表情差分ありの場合は、追加分の表情もご記入ください。"
                  className={inputClass}
                  aria-describedby={serverErrorFor("requestData.expressionMood") ? "pf-mass-expression-error" : undefined}
                />
                <FieldError id="pf-mass-expression-error" message={serverErrorFor("requestData.expressionMood")} />
              </div>
            ) : null}

            <fieldset>
              <legend className={labelClass}>
                {massProductionSelected ? "量産イラスト専用オプション" : "追加オプション"}<OptionalBadge />
              </legend>
              <div className="space-y-2">
                {optionChoices.map((choice) => {
                  const selection = state.optionSelections[choice.key];
                  const checked = selection?.selected === true;
                  const allowsQuantity = portfolioOptionAllowsQuantity(choice);
                  return (
                    <div
                      key={choice.key}
                      className="rounded-lg border-2 p-2"
                      style={{
                        borderColor: checked ? c.formBorderActive : c.formBorder,
                      }}
                    >
                      <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                        <input
                          id={`pf-option-${choice.key}`}
                          {...errorAttributes(`pf-option-${choice.key}`)}
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setOptionSelection(choice.key, { selected: event.target.checked })
                          }
                          className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0"
                        />
                        <span style={{ color: c.textSoft }}>
                          {choice.label}
                          <span className="ml-1 text-xs font-bold" style={{ color: c.accentText }}>
                            {choice.price}
                          </span>
                        </span>
                      </label>
                      {/* 数量と補足は同じ追加オプションに属するため、desktopのみ横並びにする。 */}
                      {checked && !massProductionSelected ? (
                        <div
                          className={`mt-2 grid gap-2 ${
                            allowsQuantity ? "sm:grid-cols-[7rem_1fr]" : ""
                          }`}
                        >
                          {allowsQuantity ? (
                            <div>
                              <label
                                htmlFor={`pf-option-${choice.key}-quantity`}
                                className="mb-1 block text-xs font-bold"
                                style={{ color: c.textSoft }}
                              >
                                数量
                              </label>
                              <input
                                id={`pf-option-${choice.key}-quantity`}
                                {...errorAttributes(`pf-option-${choice.key}-quantity`)}
                                type="number"
                                min={1}
                                max={10}
                                value={selection?.quantity ?? 1}
                                onChange={(event) =>
                                  setOptionSelection(choice.key, {
                                    quantity: Number(event.target.value),
                                  })
                                }
                                className={inputClass}
                              />
                            </div>
                          ) : null}
                          <div>
                            <label
                              htmlFor={`pf-option-${choice.key}-notes`}
                              className="mb-1 block text-xs font-bold"
                              style={{ color: c.textSoft }}
                            >
                              {choice.stableId === "other" ? <>補足<RequiredBadge /></> : "補足（任意）"}
                            </label>
                            <input
                              id={`pf-option-${choice.key}-notes`}
                              {...errorAttributes(`pf-option-${choice.key}-notes`)}
                              required={choice.stableId === "other"}
                              value={selection?.notes ?? ""}
                              onChange={(event) =>
                                setOptionSelection(choice.key, { notes: event.target.value })
                              }
                              maxLength={300}
                              className={inputClass}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </fieldset>

            {massProductionSelected ? (
              <>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2 text-[13px]" style={{ borderColor: state.commercialUse === "yes" ? c.formBorderActive : c.formBorder }}>
                  <input
                    id="pf-mass-commercial"
                    {...errorAttributes("pf-mass-commercial", "pf-mass-commercial-help")}
                    type="checkbox"
                    checked={state.commercialUse === "yes"}
                    onChange={(event) => update({ commercialUse: event.target.checked ? "yes" : "none" })}
                    className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0"
                  />
                  商用利用
                  <span className="text-xs font-bold" style={{ color: c.accentText }}>+{MASS_PRODUCTION_COMMERCIAL_AMOUNT.toLocaleString("ja-JP")}円</span>
                </label>
                <p id="pf-mass-commercial-help" className="text-sm leading-relaxed" style={{ color: c.textSoft }}>
                  収益化された配信・動画、グッズ、広告・宣伝など営利目的での利用はお知らせください。
                  利用範囲と追加料金はお見積もり時に確定します。
                </p>
              </>
            ) : null}
          </FormSection>

          <FormSection
            title="用途・条件"
            summary={state.usageTypes.length > 0 || state.commercialUse !== "unknown" || state.publicationPolicy !== "unknown"
              ? `用途${state.usageTypes.length}件／商用利用：${NATORI_COMMERCIAL_USE_LABELS_V1[state.commercialUse]}／実績掲載：${NATORI_PUBLICATION_POLICY_LABELS_V1[state.publicationPolicy]}`
              : undefined}
            collapsible
            open={openSections.usage}
            onToggle={(next) => setOpenSections((current) => ({ ...current, usage: next }))}
          >
            <fieldset id="pf-usage-types" tabIndex={-1} {...errorAttributes("pf-usage-types")}>
              <legend className={labelClass}>使用目的（複数選択可）</legend>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {NATORI_USAGE_TYPES_V1.map((usage) => (
                  <label
                    key={usage}
                    className="flex cursor-pointer items-center gap-2 text-[13px]"
                    style={{ color: c.textSoft }}
                  >
                    <input
                      type="checkbox"
                      checked={state.usageTypes.includes(usage)}
                      onChange={() => toggleUsageType(usage)}
                      className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0"
                    />
                    {NATORI_USAGE_TYPE_LABELS_V1[usage]}
                  </label>
                ))}
              </div>
            </fieldset>

            {state.usageTypes.includes("other") ? (
              <div>
                <label htmlFor="pf-usage-other" className={labelClass}>
                  使用目的（その他の内容）<RequiredBadge />
                </label>
                <input
                  id="pf-usage-other"
                  {...errorAttributes("pf-usage-other")}
                  required
                  value={state.usageTypeOther}
                  onChange={(event) => update({ usageTypeOther: event.target.value })}
                  maxLength={200}
                  className={inputClass}
                  aria-describedby={
                    serverErrorFor("requestData.usageTypeOther") ? "pf-usage-other-error" : undefined
                  }
                />
                <FieldError
                  id="pf-usage-other-error"
                  message={serverErrorFor("requestData.usageTypeOther")}
                />
              </div>
            ) : null}

            <div className="grid gap-4">
              {!massProductionSelected ? (
              <div>
                <label htmlFor="pf-commercial" className={labelClass}>
                  商用利用
                </label>
                <select
                  id="pf-commercial"
                  {...errorAttributes("pf-commercial", "pf-commercial-help")}
                  value={state.commercialUse}
                  onChange={(event) =>
                    update({ commercialUse: event.target.value as typeof state.commercialUse })
                  }
                  className={inputClass}
                >
                  {(Object.keys(NATORI_COMMERCIAL_USE_LABELS_V1) as Array<
                    keyof typeof NATORI_COMMERCIAL_USE_LABELS_V1
                  >).map((value) => (
                    <option key={value} value={value}>
                      {NATORI_COMMERCIAL_USE_LABELS_V1[value]}
                    </option>
                  ))}
                </select>
                <p id="pf-commercial-help" className="mt-2 text-sm leading-relaxed" style={{ color: c.textSoft }}>
                  収益化された配信・動画、グッズ、広告・宣伝など営利目的での利用はお知らせください。
                  {commercialPrice ? `料金表の商用利用：${commercialPrice}。` : ""}
                  わからない場合も相談できます。利用範囲と追加料金はお見積もり時に確定します。
                </p>
              </div>
              ) : null}
              <div>
                <label htmlFor="pf-publication" className={labelClass}>
                  ナトリによる実績掲載（作品の公開可否）
                </label>
                <select
                  id="pf-publication"
                  {...errorAttributes("pf-publication", "pf-publication-help")}
                  value={state.publicationPolicy}
                  onChange={(event) =>
                    update({
                      publicationPolicy: event.target.value as typeof state.publicationPolicy,
                    })
                  }
                  className={inputClass}
                >
                  {(Object.keys(NATORI_PUBLICATION_POLICY_LABELS_V1) as Array<
                    keyof typeof NATORI_PUBLICATION_POLICY_LABELS_V1
                  >).map((value) => (
                    <option key={value} value={value}>
                      {NATORI_PUBLICATION_POLICY_LABELS_V1[value]}
                    </option>
                  ))}
                </select>
                <p id="pf-publication-help" className="mt-2 text-sm leading-relaxed" style={{ color: c.textSoft }}>
                  ナトリがポートフォリオやSNSで制作実績として紹介してよいかをお知らせください。
                  公開範囲や時期は、お見積もり等で合意した内容を優先します。
                </p>
                {publicationOptions.length > 0 ? (
                  <p className="mt-2 text-sm" style={{ color: c.textSoft }}>
                    料金表との対応：{publicationOptions.map((option) => {
                      const policy = option.id === PORTFOLIO_OPTION_IDS.sampleUsageDenied ? "work_private" : "fully_private";
                      return `${NATORI_PUBLICATION_POLICY_LABELS_V1[policy]} → ${option.name}（${option.price}）`;
                    }).join("／")}。
                    非公開にしたい内容は相談欄へご記入ください。条件と追加料金はお見積もりでご確認いただけます。
                  </p>
                ) : null}
              </div>
            </div>

            {state.publicationPolicy === "delayed" ? (
              <div>
                <label htmlFor="pf-publication-allowed-from" className={labelClass}>
                  公開可能日<RequiredBadge />
                </label>
                <input
                  id="pf-publication-allowed-from"
                  {...errorAttributes("pf-publication-allowed-from")}
                  type="date"
                  required
                  value={state.publicationAllowedFrom}
                  onChange={(event) => update({ publicationAllowedFrom: event.target.value })}
                  className={inputClass}
                  aria-describedby={
                    serverErrorFor("requestData.publicationAllowedFrom")
                      ? "pf-publication-allowed-from-error"
                      : undefined
                  }
                />
                <p className="mt-1 text-xs" style={{ color: c.textSoft }}>
                  この日以降、ポートフォリオやSNSへ掲載できます。
                </p>
                <FieldError
                  id="pf-publication-allowed-from-error"
                  message={serverErrorFor("requestData.publicationAllowedFrom")}
                />
              </div>
            ) : null}
          </FormSection>

          <FormSection
            title="予算・納期"
            summary={state.budgetKind !== "undecided" || state.deadlineKind !== "undecided"
              ? `${NATORI_BUDGET_KIND_LABELS_V1[state.budgetKind]}／${NATORI_DEADLINE_KIND_LABELS_V1[state.deadlineKind]}`
              : undefined}
            description="どちらも「未定・相談して決めたい」を選べます。"
            collapsible
            open={openSections.budget}
            onToggle={(next) => setOpenSections((current) => ({ ...current, budget: next }))}
          >
            <div>
              <label htmlFor="pf-budget-kind" className={labelClass}>
                ご予算
              </label>
              <select
                id="pf-budget-kind"
                {...errorAttributes("pf-budget-kind")}
                value={state.budgetKind}
                onChange={(event) =>
                  update({ budgetKind: event.target.value as NatoriBudgetV1["kind"] })
                }
                  className={inputClass}
              >
                {budgetKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {NATORI_BUDGET_KIND_LABELS_V1[kind]}
                  </option>
                ))}
              </select>

              {state.budgetKind === "range" ? (
                /* 下限と上限は1つの予算範囲を構成するため、desktopのみ横並びにする。 */
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <label htmlFor="pf-budget-min" className="mb-1 block text-xs font-bold">
                      下限（円）<RequiredBadge />
                    </label>
                    <input
                      id="pf-budget-min"
                      {...errorAttributes("pf-budget-min")}
                      required
                      placeholder="例：10000"
                      inputMode="numeric"
                      value={state.budgetMin}
                      onChange={(event) => update({ budgetMin: event.target.value })}
                      className={inputClass}
                      aria-describedby={
                        serverErrorFor("requestData.budget.min") ? "pf-budget-min-error" : undefined
                      }
                    />
                    <FieldError
                      id="pf-budget-min-error"
                      message={serverErrorFor("requestData.budget.min")}
                    />
                  </div>
                  <div>
                    <label htmlFor="pf-budget-max" className="mb-1 block text-xs font-bold">
                      上限（円・任意）
                    </label>
                    <input
                      id="pf-budget-max"
                      {...errorAttributes("pf-budget-max")}
                      inputMode="numeric"
                      value={state.budgetMax}
                      onChange={(event) => update({ budgetMax: event.target.value })}
                      className={inputClass}
                      aria-describedby={
                        serverErrorFor("requestData.budget.max") ? "pf-budget-max-error" : undefined
                      }
                    />
                    <FieldError
                      id="pf-budget-max-error"
                      message={serverErrorFor("requestData.budget.max")}
                    />
                  </div>
                </div>
              ) : null}

              {state.budgetKind === "fixed" ? (
                <div className="mt-2">
                  <label htmlFor="pf-budget-fixed" className="mb-1 block text-xs font-bold">
                    ご予算（円）<RequiredBadge />
                  </label>
                  <input
                    id="pf-budget-fixed"
                    {...errorAttributes("pf-budget-fixed")}
                    required
                    placeholder="例：10000"
                    inputMode="numeric"
                    value={state.budgetMin}
                    onChange={(event) => update({ budgetMin: event.target.value })}
                    className={inputClass}
                    aria-describedby={
                      serverErrorFor("requestData.budget.min") ? "pf-budget-fixed-error" : undefined
                    }
                  />
                  <FieldError
                    id="pf-budget-fixed-error"
                    message={serverErrorFor("requestData.budget.min")}
                  />
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="pf-deadline-kind" className={labelClass}>
                希望納期
              </label>
              <select
                id="pf-deadline-kind"
                {...errorAttributes("pf-deadline-kind")}
                value={state.deadlineKind}
                onChange={(event) =>
                  update({ deadlineKind: event.target.value as NatoriDeadlineV1["kind"] })
                }
                className={inputClass}
              >
                {deadlineKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {NATORI_DEADLINE_KIND_LABELS_V1[kind]}
                  </option>
                ))}
              </select>

              {state.deadlineKind === "standard" ? (
                <p className="mt-2 text-sm" style={{ color: c.textSoft }}>
                  通常はご入金確認後から約1か月が目安です。実際の納期はお見積もり等で定めた内容を優先します。
                </p>
              ) : null}

              {state.deadlineKind === "preferred_date" ||
              state.deadlineKind === "rush_consultation" ? (
                <div className="mt-2">
                  <label htmlFor="pf-deadline-date" className="mb-1 block text-xs font-bold">
                    希望日
                    {state.deadlineKind === "preferred_date" ? (
                      <RequiredBadge />
                    ) : (
                      <span style={{ color: c.textSoft }}>（任意）</span>
                    )}
                  </label>
                  <input
                    id="pf-deadline-date"
                    {...errorAttributes("pf-deadline-date")}
                    required={state.deadlineKind === "preferred_date"}
                    type="date"
                    value={state.deadlineDate}
                    onChange={(event) => update({ deadlineDate: event.target.value })}
                    className={inputClass}
                    aria-describedby={
                      serverErrorFor("requestData.deadline.date")
                        ? "pf-deadline-date-error"
                        : undefined
                    }
                  />
                  <FieldError
                    id="pf-deadline-date-error"
                    message={serverErrorFor("requestData.deadline.date")}
                  />
                </div>
              ) : null}

              <div className="mt-2">
                <label htmlFor="pf-deadline-note" className="mb-1 block text-xs font-bold">
                  納期の補足（任意）
                </label>
                <input
                  id="pf-deadline-note"
                  {...errorAttributes("pf-deadline-note")}
                  value={state.deadlineNote}
                  onChange={(event) => update({ deadlineNote: event.target.value })}
                  maxLength={500}
                  className={inputClass}
                />
              </div>
            </div>
          </FormSection>

          <details
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            <summary className="pf-cute-focus cursor-pointer text-sm font-bold">
              キャラクター・イメージの詳細を入力する
              <OptionalBadge />
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="pf-character" className={labelClass}>
                  キャラクターの特徴
                </label>
                <textarea
                  id="pf-character"
                  {...errorAttributes("pf-character")}
                  rows={3}
                  maxLength={1000}
                  value={state.characterFeatures}
                  onChange={(event) => update({ characterFeatures: event.target.value })}
                  placeholder="髪型・髪色・目の色・服装・体型など"
                  className={inputClass}
                />
              </div>
              {!massProductionSelected ? (
              <div>
                <label htmlFor="pf-expression" className={labelClass}>
                  希望する表情・雰囲気
                </label>
                <textarea
                  id="pf-expression"
                  {...errorAttributes("pf-expression")}
                  rows={2}
                  maxLength={1000}
                  value={state.expressionMood}
                  onChange={(event) => update({ expressionMood: event.target.value })}
                  className={inputClass}
                />
              </div>
              ) : null}
              <div>
                <label htmlFor="pf-composition" className={labelClass}>
                  構図のイメージ
                </label>
                <textarea
                  id="pf-composition"
                  {...errorAttributes("pf-composition")}
                  rows={2}
                  maxLength={1000}
                  value={state.composition}
                  onChange={(event) => update({ composition: event.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pf-color" className={labelClass}>
                  色のイメージ
                </label>
                <textarea
                  id="pf-color"
                  {...errorAttributes("pf-color")}
                  rows={2}
                  maxLength={1000}
                  value={state.colorDirection}
                  onChange={(event) => update({ colorDirection: event.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pf-reference-notes" className={labelClass}>
                  資料についての補足
                </label>
                <textarea
                  id="pf-reference-notes"
                  {...errorAttributes("pf-reference-notes")}
                  rows={2}
                  maxLength={2000}
                  value={state.referenceNotes}
                  onChange={(event) => update({ referenceNotes: event.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </details>

          <FormSection
            title="資料"
            summary={refImages.length > 0 || state.referenceLinks.some((row) => row.url.trim())
              ? `画像${refImages.length}枚／参考URL${state.referenceLinks.filter((row) => row.url.trim()).length}件`
              : undefined}
            description={`画像${NATORI_MAX_REFERENCE_IMAGES}枚・合計10MB / 参考URL${NATORI_MAX_REFERENCE_LINKS}件まで`}
            collapsible
            open={openSections.materials}
            onToggle={(next) => setOpenSections((current) => ({ ...current, materials: next }))}
          >
            <div>
              <span className={labelClass}>キャラクター資料（画像添付）</span>
              {refImages.length > 0 ? (
                <ul className="mb-3 flex flex-wrap gap-3">
                  {refImages.map((entry, index) => (
                    <li key={entry.previewUrl} className="relative">
                      {/* ローカル選択ファイルの objectURL プレビューなので next/image は使わない */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.previewUrl}
                        alt={`添付画像 ${index + 1}`}
                        className="h-20 w-20 rounded-lg border-2 object-cover"
                        style={{ borderColor: c.borderSubtle }}
                      />
                      <button
                        type="button"
                        onClick={() => removeRefImage(index)}
                        className="pf-cute-focus absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white shadow"
                        style={{ background: c.error, color: c.onError }}
                        aria-label={`添付画像 ${index + 1} を外す`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {refImages.length < NATORI_MAX_REFERENCE_IMAGES ? (
                <button
                  id="pf-add-images"
                  {...errorAttributes("pf-add-images")}
                  type="button"
                  onClick={() => refFileInputRef.current?.click()}
                  className="pf-cute-focus inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-4 py-2 text-sm font-bold"
                  style={{ borderColor: c.formBorderActive, color: c.formBorderActive }}
                >
                  ＋ 画像を追加
                </button>
              ) : null}
              <FieldError id="pf-ref-image-error" message={refImageError ?? undefined} />
              <input
                ref={refFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                multiple
                className="hidden"
                aria-label="キャラクター資料の画像を選択"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  event.target.value = "";
                  handleRefFiles(files);
                }}
              />
            </div>

            <fieldset>
              <legend className={labelClass}>
                参考URL<OptionalBadge />
              </legend>
              <p className="mb-2 text-xs" style={{ color: c.textSoft }}>
                設定資料や衣装の参考などを共有できます。閲覧できる共有設定をご確認ください。https:// で始まるURLを入力してください。
              </p>
              <ul className="space-y-3">
                {state.referenceLinks.map((row, index) => {
                  const error = linkErrors.find((item) => item.index === index)?.message;
                  const serverError = serverErrorFor(`referenceLinks.${index}.url`);
                  return (
                    <li key={index} className="rounded-lg border-2 p-2" style={{ borderColor: c.borderSubtle }}>
                      {/* URLとそのラベルは同じ参考資料を表すため、desktopのみ横並びにする。 */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor={`pf-ref-url-${index}`}
                            className="mb-1 block text-xs font-bold"
                            style={{ color: c.textSoft }}
                          >
                            参考URL {index + 1}
                          </label>
                          <input
                            id={`pf-ref-url-${index}`}
                            {...errorAttributes(`pf-ref-url-${index}`)}
                            type="url"
                            inputMode="url"
                            value={row.url}
                            onChange={(event) => setReferenceLink(index, { url: event.target.value })}
                            maxLength={2048}
                            placeholder="https://"
                            className={inputClass}
                            aria-describedby={
                              error || serverError ? `pf-ref-url-${index}-error` : undefined
                            }
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`pf-ref-label-${index}`}
                            className="mb-1 block text-xs font-bold"
                            style={{ color: c.textSoft }}
                          >
                            このURLの内容（任意）
                          </label>
                          <input
                            id={`pf-ref-label-${index}`}
                            {...errorAttributes(`pf-ref-label-${index}`)}
                            value={row.label}
                            onChange={(event) =>
                              setReferenceLink(index, { label: event.target.value })
                            }
                            maxLength={100}
                            placeholder="例：キャラクター設定資料、衣装の参考"
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <FieldError id={`pf-ref-url-${index}-error`} message={error ?? serverError} />
                      {state.referenceLinks.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeReferenceLinkRow(index)}
                          className="pf-cute-focus mt-2 text-xs font-bold underline"
                          style={{ color: c.error }}
                        >
                          {`参考URL ${index + 1} を削除`}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {state.referenceLinks.length < NATORI_MAX_REFERENCE_LINKS ? (
                <button
                  type="button"
                  onClick={addReferenceLinkRow}
                  className="pf-cute-focus mt-3 inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-4 py-2 text-sm font-bold"
                  style={{ borderColor: c.formBorderActive, color: c.formBorderActive }}
                >
                  ＋ 参考URLを追加
                </button>
              ) : null}
            </fieldset>
          </FormSection>

        </div>
      </details>
  );

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onInvalidCapture={(event) => {
        // 閉じた詳細内の必須項目にも、ブラウザがフォーカスを移せるようにする。
        let details = (event.target as HTMLElement).closest("details");
        while (details) {
          details.open = true;
          details = details.parentElement?.closest("details") ?? null;
        }
      }}
      noValidate
      className="pf-commission-form space-y-4 rounded-2xl p-5 md:p-8"
      style={{ background: c.surface, boxShadow: `0 10px 22px ${c.shadowSoft}` }}
    >
      <PortfolioFormStyles />
      {/* honeypot: 人間には見えない。ボット対策 */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <FormSection title="ご希望・連絡先">
        <fieldset>
          <legend className={labelClass}>ご希望</legend>
          {/* 同じ意思決定の2択を比較するカードなので、desktopのみ横並びにする。 */}
          <div className="grid gap-2 sm:grid-cols-2">
            {(["consultation", "quote"] as const).map((mode) => (
              <label
                key={mode}
                className="pf-cute-focus flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-[13px] font-bold"
                style={{
                  borderColor:
                    state.inquiryMode === mode ? c.formBorderActive : c.formBorder,
                  color: state.inquiryMode === mode ? c.formBorderActive : c.textSoft,
                }}
              >
                <input
                  type="radio"
                  name="inquiryMode"
                  value={mode}
                  checked={state.inquiryMode === mode}
                  onChange={() => changeMode(mode)}
                  className="pf-choice-control h-4 w-4 shrink-0"
                />
                {NATORI_INQUIRY_MODE_LABELS_V1[mode]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4">
          <div>
            <label htmlFor="pf-name" className={labelClass}>
              お名前（活動名でOK）<RequiredBadge />
            </label>
            <input
              id="pf-name"
              {...errorAttributes("pf-name")}
              name="name"
              required
              maxLength={100}
              autoComplete="name"
              className={inputClass}
              aria-describedby={serverErrorFor("clientName") ? "pf-name-error" : undefined}
            />
            <FieldError id="pf-name-error" message={serverErrorFor("clientName")} />
          </div>
          <div>
            <label htmlFor="pf-email" className={labelClass}>
              メールアドレス<RequiredBadge />
            </label>
            <input
              id="pf-email"
              {...errorAttributes("pf-email")}
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              className={inputClass}
              aria-describedby={serverErrorFor("clientEmail") ? "pf-email-error" : undefined}
            />
            <FieldError id="pf-email-error" message={serverErrorFor("clientEmail")} />
          </div>
        </div>
      </FormSection>

      {messageSection}
      {optionalSection}

      <FormSection title="確認して送信">
        {submitError ? (
          <p
            id="pf-submit-errors"
            tabIndex={-1}
            className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
            style={{ borderColor: c.error, color: c.error, background: c.errorSoft }}
            role="alert"
          >
            {submitError}
          </p>
        ) : null}
        {serverFieldErrors.length > 0 ? (
          <ul className="space-y-1 text-xs font-bold" style={{ color: c.error }}>
            {serverFieldErrors.map((error, index) => (
              <li key={`${error.path}:${error.message}`} id={`pf-submit-error-${index}`}>
                <button type="button" className="pf-cute-focus min-h-[44px] text-left underline underline-offset-4" onClick={() => focusError(error)}>
                  {error.message}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <PortfolioLegalNotice />
        <button
          type="submit"
          disabled={!commissionOpen || sending || retrySeconds > 0}
          aria-busy={sending}
          className="pf-cute-focus w-full rounded-full border-2 py-3.5 text-base font-black hover:brightness-95 disabled:opacity-50"
          style={{
            background: c.action,
            borderColor: c.actionDisplay,
            color: c.onAction,
          }}
        >
          {!commissionOpen ? "現在受付停止中です" : sending ? "送信中…" : retrySeconds > 0
            ? `再送まで ${retrySeconds}秒`
            : state.inquiryMode === "quote" ? "見積もり相談を送信する" : "相談内容を送信する"}
        </button>
      </FormSection>
    </form>
  );
}
