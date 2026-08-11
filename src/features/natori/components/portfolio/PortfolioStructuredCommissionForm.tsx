"use client";

// features/natori/components/portfolio/PortfolioStructuredCommissionForm.tsx
// P1-06 の構造化ご依頼フォーム本体。入力 state → RequestData V1 の変換は
// features/natori/lib/portfolioRequestForm.ts（共有純関数）に集約し、
// UI 独自の payload 形は作らない。検証の真実源は server 側の共有 schema。
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  PLAN_SELECT_EVENT,
  portfolioColors as c,
  type PortfolioPlanSelectDetail,
} from "@/features/natori/constants/portfolioContent";
import { trackNatoriPageEvent } from "@/features/natori/data/pageEvents";
import {
  NATORI_MAX_REFERENCE_IMAGES,
  NATORI_MAX_REFERENCE_LINKS,
  NATORI_REFERENCE_IMAGES_TOTAL_MAX_BYTES,
  NATORI_REFERENCE_IMAGE_MAX_BYTES,
  NATORI_STRUCTURED_FORM_VERSION,
  applyPortfolioPlanSelection,
  buildNatoriRequestDataV1,
  collectPortfolioReferenceLinkErrors,
  createInitialPortfolioRequestFormState,
  portfolioOptionChoices,
  pruneHiddenPortfolioRequestFields,
  submittedPortfolioReferenceLinks,
  type PortfolioRequestFormState,
} from "@/features/natori/lib/portfolioRequestForm";
import {
  NATORI_BUDGET_KIND_LABELS_V1,
  NATORI_COMMERCIAL_USE_LABELS_V1,
  NATORI_COMMISSION_SCOPE_LABELS_V1,
  NATORI_DEADLINE_KIND_LABELS_V1,
  NATORI_INQUIRY_MODE_LABELS_V1,
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
  type NatoriRequestDataV1,
  type NatoriUsageTypeV1,
} from "@/features/natori/types/request";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import { CSRF_HEADERS } from "@/lib/auth/csrf";

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
  step,
  title,
  description,
  collapsible,
  open,
  onToggle,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: (next: boolean) => void;
  children: ReactNode;
}) {
  const heading = (
    <>
      <span
        className="mr-2 inline-grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black text-white"
        style={{ background: c.accent, color: c.onAccent }}
        aria-hidden="true"
      >
        {step}
      </span>
      {title}
    </>
  );

  if (!collapsible) {
    return (
      <section className="rounded-xl border-2 p-4" style={{ borderColor: c.borderSubtle }}>
        <h3 className="mb-3 flex items-center text-base font-black">{heading}</h3>
        {description ? (
          <p className="mb-3 text-xs" style={{ color: c.textSoft }}>
            {description}
          </p>
        ) : null}
        <div className="space-y-4">{children}</div>
      </section>
    );
  }

  return (
    <details
      className="rounded-xl border-2 p-4"
      style={{ borderColor: c.borderSubtle }}
      open={open}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary className="pf-cute-focus flex cursor-pointer items-center text-base font-black">
        {heading}
        <OptionalBadge />
      </summary>
      {description ? (
        <p className="mt-3 text-xs" style={{ color: c.textSoft }}>
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [openSections, setOpenSections] = useState({
    requestType: false,
    usage: false,
    budget: false,
  });
  const refFileInputRef = useRef<HTMLInputElement | null>(null);
  const sendingRef = useRef(false);

  const optionChoices = useMemo(() => portfolioOptionChoices(content), [content]);
  const linkErrors = collectPortfolioReferenceLinkErrors(state.referenceLinks);

  const update = (patch: Partial<PortfolioRequestFormState>) =>
    setState((current) => pruneHiddenPortfolioRequestFields({ ...current, ...patch }));

  /** モード切替で任意セクションの開閉だけを変える。残留値は prune で落とす。 */
  const changeMode = (inquiryMode: NatoriInquiryModeV1) => {
    update({ inquiryMode });
    const expanded = inquiryMode === "quote";
    setOpenSections({ requestType: expanded, usage: expanded, budget: expanded });
    setDetailsOpen(expanded);
  };

  // 料金カードの「このプランで相談」からプランを受け取る
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<PortfolioPlanSelectDetail>).detail;
      if (!detail) return;
      setState((current) => applyPortfolioPlanSelection(current, detail.id));
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
    if (sendingRef.current) return;
    if (linkErrors.length > 0) {
      setSubmitError("参考URLの入力内容をご確認ください。");
      return;
    }

    const form = event.currentTarget;
    const requestData: NatoriRequestDataV1 = buildNatoriRequestDataV1(state, optionChoices);

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
    const payload = new FormData(form);
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
        if (Array.isArray(response?.fields)) setServerFieldErrors(response.fields);
        setSubmitError(
          response?.error === "invalid_request"
            ? "入力内容をご確認ください。"
            : "送信に失敗しました。時間をおいて再度お試しいただくか、SNSのDMからご連絡ください。"
        );
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

  return (
    <form
      onSubmit={handleSubmit}
      noValidate={false}
      className="space-y-4 rounded-2xl p-5 md:p-8"
      style={{ background: c.surface, boxShadow: "0 10px 22px rgba(36,36,36,0.08)" }}
    >
      {/* honeypot: 人間には見えない。ボット対策 */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <FormSection
        step={1}
        title="ご相談か、お見積もりか"
        description="どちらでも、決まっていない項目は「未定・相談して決めたい」のままで送信できます。"
      >
        <fieldset>
          <legend className={labelClass}>ご希望</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["consultation", "quote"] as const).map((mode) => (
              <label
                key={mode}
                className="pf-cute-focus flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-bold"
                style={{
                  borderColor: state.inquiryMode === mode ? c.accent : c.borderStrong,
                  color: state.inquiryMode === mode ? c.accent : c.textSoft,
                }}
              >
                <input
                  type="radio"
                  value={mode}
                  checked={state.inquiryMode === mode}
                  onChange={() => changeMode(mode)}
                  className="h-4 w-4 shrink-0"
                  style={{ accentColor: c.accent }}
                />
                {NATORI_INQUIRY_MODE_LABELS_V1[mode]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-name" className={labelClass}>
              お名前（活動名でOK）<span style={{ color: c.error }}>＊</span>
            </label>
            <input
              id="pf-name"
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
              メールアドレス<span style={{ color: c.error }}>＊</span>
            </label>
            <input
              id="pf-email"
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

      <FormSection
        step={2}
        title="依頼の種類"
        description="未定のままでも受け付けます。決まっている場合だけご選択ください。"
        collapsible
        open={openSections.requestType}
        onToggle={(next) => setOpenSections((current) => ({ ...current, requestType: next }))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-request-type" className={labelClass}>
              ご依頼の種類
            </label>
            <select
              id="pf-request-type"
              value={state.requestType}
              onChange={(event) =>
                update({ requestType: event.target.value as typeof state.requestType })
              }
              className={inputClass}
            >
              {NATORI_REQUEST_TYPES_V1.map((type) => (
                <option key={type} value={type}>
                  {NATORI_REQUEST_TYPE_LABELS_V1[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pf-scope" className={labelClass}>
              制作範囲
            </label>
            <select
              id="pf-scope"
              value={state.commissionScope}
              onChange={(event) =>
                update({ commissionScope: event.target.value as typeof state.commissionScope })
              }
              className={inputClass}
            >
              {NATORI_COMMISSION_SCOPES_V1.map((scope) => (
                <option key={scope} value={scope}>
                  {NATORI_COMMISSION_SCOPE_LABELS_V1[scope]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {state.requestType === "other" ? (
          <div>
            <label htmlFor="pf-request-type-other" className={labelClass}>
              ご依頼の種類（その他の内容）<span style={{ color: c.error }}>＊</span>
            </label>
            <input
              id="pf-request-type-other"
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
              制作範囲（その他の内容）<span style={{ color: c.error }}>＊</span>
            </label>
            <input
              id="pf-scope-other"
              value={state.commissionScopeOther}
              onChange={(event) => update({ commissionScopeOther: event.target.value })}
              maxLength={100}
              className={inputClass}
              aria-describedby={
                serverErrorFor("requestData.commissionScopeOther")
                  ? "pf-scope-other-error"
                  : undefined
              }
            />
            <FieldError
              id="pf-scope-other-error"
              message={serverErrorFor("requestData.commissionScopeOther")}
            />
          </div>
        ) : null}

        <fieldset>
          <legend className={labelClass}>
            追加オプション<OptionalBadge />
          </legend>
          <div className="space-y-2">
            {optionChoices.map((choice) => {
              const selection = state.optionSelections[choice.key];
              const checked = selection?.selected === true;
              return (
                <div
                  key={choice.key}
                  className="rounded-lg border-2 p-2"
                  style={{ borderColor: checked ? c.accent : c.borderStrong }}
                >
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        setOptionSelection(choice.key, { selected: event.target.checked })
                      }
                      className="pf-cute-focus h-4 w-4 shrink-0"
                      style={{ accentColor: c.accent }}
                    />
                    <span style={{ color: c.textSoft }}>
                      {choice.label}
                      <span className="ml-1 text-xs font-bold" style={{ color: c.accent }}>
                        {choice.price}
                      </span>
                    </span>
                  </label>
                  {checked ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-[7rem_1fr]">
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
                      <div>
                        <label
                          htmlFor={`pf-option-${choice.key}-notes`}
                          className="mb-1 block text-xs font-bold"
                          style={{ color: c.textSoft }}
                        >
                          補足（任意）
                        </label>
                        <input
                          id={`pf-option-${choice.key}-notes`}
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
      </FormSection>

      <FormSection
        step={3}
        title="用途・条件"
        description="商用利用や公開範囲が未定でも「わからない・相談したい」で送信できます。"
        collapsible
        open={openSections.usage}
        onToggle={(next) => setOpenSections((current) => ({ ...current, usage: next }))}
      >
        <fieldset>
          <legend className={labelClass}>使用目的（複数選択可）</legend>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {NATORI_USAGE_TYPES_V1.map((usage) => (
              <label
                key={usage}
                className="flex cursor-pointer items-center gap-2 text-sm"
                style={{ color: c.textSoft }}
              >
                <input
                  type="checkbox"
                  checked={state.usageTypes.includes(usage)}
                  onChange={() => toggleUsageType(usage)}
                  className="pf-cute-focus h-4 w-4 shrink-0"
                  style={{ accentColor: c.accent }}
                />
                {NATORI_USAGE_TYPE_LABELS_V1[usage]}
              </label>
            ))}
          </div>
        </fieldset>

        {state.usageTypes.includes("other") ? (
          <div>
            <label htmlFor="pf-usage-other" className={labelClass}>
              使用目的（その他の内容）<span style={{ color: c.error }}>＊</span>
            </label>
            <input
              id="pf-usage-other"
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-commercial" className={labelClass}>
              商用利用
            </label>
            <select
              id="pf-commercial"
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
          </div>
          <div>
            <label htmlFor="pf-publication" className={labelClass}>
              作品の公開可否
            </label>
            <select
              id="pf-publication"
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
          </div>
        </div>
      </FormSection>

      <FormSection
        step={4}
        title="予算・納期"
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
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-budget-min" className="mb-1 block text-xs font-bold">
                  下限（円）
                </label>
                <input
                  id="pf-budget-min"
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
                ご予算（円）
              </label>
              <input
                id="pf-budget-fixed"
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

          {state.deadlineKind === "preferred_date" ||
          state.deadlineKind === "rush_consultation" ? (
            <div className="mt-2">
              <label htmlFor="pf-deadline-date" className="mb-1 block text-xs font-bold">
                希望日
                {state.deadlineKind === "preferred_date" ? (
                  <span style={{ color: c.error }}>＊</span>
                ) : (
                  <span style={{ color: c.textSoft }}>（任意）</span>
                )}
              </label>
              <input
                id="pf-deadline-date"
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
              value={state.deadlineNote}
              onChange={(event) => update({ deadlineNote: event.target.value })}
              maxLength={500}
              className={inputClass}
            />
          </div>
        </div>
      </FormSection>

      <FormSection
        step={5}
        title="ご相談・ご依頼の内容"
        description="わかる範囲でOKです。ここだけの入力でも送信できます。"
      >
        <div>
          <label htmlFor="pf-message" className={labelClass}>
            ご相談・ご依頼の内容<span style={{ color: c.error }}>＊</span>
          </label>
          <textarea
            id="pf-message"
            rows={5}
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
        </div>

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
                rows={3}
                maxLength={1000}
                value={state.characterFeatures}
                onChange={(event) => update({ characterFeatures: event.target.value })}
                placeholder="髪型・髪色・目の色・服装・体型など"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pf-expression" className={labelClass}>
                希望する表情・雰囲気
              </label>
              <textarea
                id="pf-expression"
                rows={2}
                maxLength={1000}
                value={state.expressionMood}
                onChange={(event) => update({ expressionMood: event.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="pf-composition" className={labelClass}>
                構図のイメージ
              </label>
              <textarea
                id="pf-composition"
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
                rows={2}
                maxLength={2000}
                value={state.referenceNotes}
                onChange={(event) => update({ referenceNotes: event.target.value })}
                className={inputClass}
              />
            </div>
          </div>
        </details>
      </FormSection>

      <FormSection
        step={6}
        title="資料"
        description={`画像は最大${NATORI_MAX_REFERENCE_IMAGES}枚（合計10MBまで）、参考URLは最大${NATORI_MAX_REFERENCE_LINKS}件までお送りいただけます。`}
        collapsible
        open
        onToggle={() => undefined}
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
                    style={{ background: c.error, color: c.onAccent }}
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
              type="button"
              onClick={() => refFileInputRef.current?.click()}
              className="pf-cute-focus inline-flex items-center gap-1.5 rounded-full border-2 bg-white px-4 py-2 text-sm font-bold"
              style={{ borderColor: c.accent, color: c.accent }}
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
            https:// で始まるURLのみ受け付けます。こちらからURLへアクセスはしません。
          </p>
          <ul className="space-y-3">
            {state.referenceLinks.map((row, index) => {
              const error = linkErrors.find((item) => item.index === index)?.message;
              const serverError = serverErrorFor(`referenceLinks.${index}.url`);
              return (
                <li key={index} className="rounded-lg border-2 p-2" style={{ borderColor: c.borderSubtle }}>
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
                        ラベル（任意）
                      </label>
                      <input
                        id={`pf-ref-label-${index}`}
                        value={row.label}
                        onChange={(event) =>
                          setReferenceLink(index, { label: event.target.value })
                        }
                        maxLength={100}
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
              style={{ borderColor: c.accent, color: c.accent }}
            >
              ＋ 参考URLを追加
            </button>
          ) : null}
        </fieldset>
      </FormSection>

      <FormSection step={7} title="確認して送信">
        {submitError ? (
          <p
            className="rounded-xl border-2 px-3 py-2 text-sm font-bold"
            style={{ borderColor: c.error, color: c.error, background: c.errorSoft }}
            role="alert"
          >
            {submitError}
          </p>
        ) : null}
        {serverFieldErrors.length > 0 ? (
          <ul className="space-y-1 text-xs font-bold" style={{ color: c.error }}>
            {serverFieldErrors.map((error) => (
              <li key={`${error.path}:${error.message}`}>{error.message}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="submit"
          disabled={!commissionOpen || sending}
          aria-busy={sending}
          className="pf-cute-focus w-full rounded-full py-3 font-bold text-white disabled:opacity-50"
          style={{ background: c.accent, color: c.onAccent }}
        >
          {!commissionOpen ? "現在受付停止中です" : sending ? "送信中…" : "この内容で送信する"}
        </button>
      </FormSection>
    </form>
  );
}
