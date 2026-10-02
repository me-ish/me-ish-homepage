// One validated envelope is used by confirmation and the subsequent POST.
// Operation identity and recovery remain in the Phase 3A intake client.
import {
  buildNatoriRequestDataV1,
  collectPortfolioQuantityErrors,
  collectPortfolioReferenceLinkErrors,
  submittedPortfolioReferenceLinks,
  type PortfolioOptionChoice,
  type PortfolioReferenceLinkRow,
  type PortfolioRequestFormState,
} from "./portfolioRequestForm";
import { natoriRequestSubmissionV1Schema, type NatoriRequestFieldError } from "./requestSchema";
import { portfolioValidationMessage } from "./portfolioFormFeedback";
import { normalizeNatoriReferenceUrl } from "./referenceLinks";
import { buildNatoriInquiryRequestView, type NatoriInquiryRequestSection } from "./inquiryRequestView";
import type { NatoriRequestDataV1, NatoriRequestSubmissionV1 } from "../types/request";

export type PortfolioFormValidation =
  | { success: true; data: NatoriRequestSubmissionV1; referenceLinks: PortfolioReferenceLinkRow[] }
  | { success: false; errors: NatoriRequestFieldError[] };

export function validatePortfolioForm(
  state: PortfolioRequestFormState,
  choices: PortfolioOptionChoice[],
  clientName: string,
  clientEmail: string,
): PortfolioFormValidation {
  // Validate the selected raw values before the builder can normalize them.
  const quantityErrors = collectPortfolioQuantityErrors(state, choices);
  if (quantityErrors.length > 0) return { success: false, errors: quantityErrors };
  const parsed = natoriRequestSubmissionV1Schema.safeParse({
    clientName, clientEmail, requestData: buildNatoriRequestDataV1(state, choices),
  });
  const errors: NatoriRequestFieldError[] = parsed.success ? [] : parsed.error.issues.map((issue) => ({
    path: issue.path.join("."), message: portfolioValidationMessage(issue),
  }));
  errors.push(...collectPortfolioReferenceLinkErrors(state.referenceLinks).map((error) => ({
    path: `referenceLinks.${error.index}.url`, message: error.message,
  })));
  return parsed.success && errors.length === 0
    ? { success: true, data: parsed.data, referenceLinks: submittedPortfolioReferenceLinks(state.referenceLinks).map((row) => ({
        ...row, url: normalizeNatoriReferenceUrl(row.url) ?? row.url,
      })) }
    : { success: false, errors };
}

/** Validate only the current input screen. Projected values must never be submitted. */
export function validatePortfolioStep(
  state: PortfolioRequestFormState,
  choices: PortfolioOptionChoice[],
  clientName: string,
  clientEmail: string,
  step: number,
): NatoriRequestFieldError[] {
  let current = state;
  let name = clientName;
  let email = clientEmail;
  if (state.inquiryMode === "quote" && step === 0) {
    // Neutral later fields prevent an invalid budget type from aborting the
    // shared schema's current-screen Other and mass-production refinements.
    current = {
      ...state, usageTypes: [], usageTypeOther: "", commercialUse: "unknown",
      publicationPolicy: "unknown", publicationAllowedFrom: "",
      budgetKind: "undecided", budgetMin: "", budgetMax: "",
      deadlineKind: "undecided", deadlineDate: "", deadlineNote: "",
    };
    name = "確認用";
    email = "validation@example.invalid";
  } else if (state.inquiryMode === "quote" && step === 1) {
    current = {
      ...state, requestType: "undecided", requestTypeOther: "",
      commissionScope: "undecided", commissionScopeOther: "", optionSelections: {},
      characterFeatures: "", expressionMood: "", composition: "", colorDirection: "",
      referenceNotes: "", message: "", referenceLinks: [],
    };
  }
  const result = validatePortfolioForm(current, choices, name, email);
  return result.success ? [] : result.errors;
}

/** Read the original frozen answers without rebuilding labels from current content. */
export function readFrozenPortfolioSubmission(
  fields: Record<string, string | string[]>,
): PortfolioFormValidation {
  const invalid = (): PortfolioFormValidation => ({ success: false, errors: [{
    path: "requestData", message: "前回の送信内容を表示できません。受付結果の確認から保存状況をご確認ください。",
  }] });
  if (typeof fields.name !== "string" || typeof fields.email !== "string" ||
      typeof fields.requestData !== "string" || typeof fields.referenceLinks !== "string") return invalid();
  try {
    const requestData: unknown = JSON.parse(fields.requestData);
    const references: unknown = JSON.parse(fields.referenceLinks);
    if (!Array.isArray(references) || !references.every((row: unknown) =>
      typeof row === "object" && row !== null && "url" in row && "label" in row &&
      typeof row.url === "string" && typeof row.label === "string" && row.label.length <= 100)) return invalid();
    const referenceLinks: PortfolioReferenceLinkRow[] = references.map((row: { url: string; label: string }) => ({ url: row.url, label: row.label }));
    if (collectPortfolioReferenceLinkErrors(referenceLinks).length > 0) return invalid();
    const parsed = natoriRequestSubmissionV1Schema.safeParse({ clientName: fields.name, clientEmail: fields.email, requestData });
    return parsed.success ? { success: true, data: parsed.data, referenceLinks } : invalid();
  } catch { return invalid(); }
}

/** The admin reader supplies the labels and meanings; empty optional answers are omitted. */
export function portfolioConfirmationSections(request: NatoriRequestDataV1): NatoriInquiryRequestSection[] {
  const view = buildNatoriInquiryRequestView(request);
  if (view.kind !== "structured") return [];
  const detailKeys = ["characterFeatures", "expressionMood", "composition", "colorDirection", "referenceNotes", "message"] as const;
  return ["request", "details", "usage", "conditions"].flatMap((key) => {
    const section = view.sections.find((item) => item.key === key);
    if (!section) return [];
    const fields = section.fields.filter((field) => {
      if (field.key === "options") return request.options.length > 0;
      const detail = detailKeys.find((item) => item === field.key);
      return detail === undefined || request[detail].trim().length > 0;
    });
    return fields.length > 0 ? [{ ...section, fields }] : [];
  });
}
