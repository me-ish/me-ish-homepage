import type { PortfolioContent } from "../types/portfolio";
import { canonicalizeIntake, type IntakeTextFields } from "./intakeOperation";
import { createInitialPortfolioRequestFormState, portfolioOptionChoices, massProductionOptionChoices, isMassProductionIllustrationSelection, type PortfolioRequestFormState } from "./portfolioRequestForm";

/** Restore the frozen submitted answers, including raw text, without creating a fresh operation. */
export function restoreStructuredIntakeFields(fields: IntakeTextFields, content: PortfolioContent): { state: PortfolioRequestFormState; clientName: string; clientEmail: string } {
  const { submission, referenceLinks } = canonicalizeIntake(fields, []), r = submission.requestData;
  if(r.formVersion !== "etorie-request-v1") throw new Error("saved_operation_invalid");
  const state: PortfolioRequestFormState = { ...createInitialPortfolioRequestFormState(),
    inquiryMode:r.inquiryMode,requestType:r.requestType,requestTypeOther:r.requestTypeOther??"",commissionScope:r.commissionScope,commissionScopeOther:r.commissionScopeOther??"",
    usageTypes:r.usageTypes,usageTypeOther:r.usageTypeOther??"",commercialUse:r.commercialUse,publicationPolicy:r.publicationPolicy,publicationAllowedFrom:r.publicationAllowedFrom??"",
    budgetKind:r.budget.kind,budgetMin:r.budget.min===null?"":String(r.budget.min),budgetMax:r.budget.max===null?"":String(r.budget.max),
    deadlineKind:r.deadline.kind,deadlineDate:r.deadline.date??"",deadlineNote:r.deadline.note,characterFeatures:r.characterFeatures,expressionMood:r.expressionMood,composition:r.composition,colorDirection:r.colorDirection,referenceNotes:r.referenceNotes,message:r.message,
    referenceLinks:referenceLinks.length?referenceLinks.map(link=>({url:link.url,label:link.label??""})):[{url:"",label:""}],
  };
  const choices=isMassProductionIllustrationSelection(state)?massProductionOptionChoices():portfolioOptionChoices(content);
  for(const option of r.options){const choice=choices.find(item=>option.id?item.stableId===option.id:item.stableId===null&&item.label===option.label);
    if(choice)state.optionSelections[choice.key]={selected:true,quantity:option.quantity,notes:option.notes};}
  return {state,clientName:submission.clientName,clientEmail:submission.clientEmail};
}
