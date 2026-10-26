import {caseSystemReviewSchema, type CaseSystemControlInput} from "../lib/caseSystemControl";
export class CaseSystemAccessRejected extends Error {}
async function response(request: Promise<Response>) {
  const result = await request;
  if (result.status === 401) throw new CaseSystemAccessRejected();
  const body: unknown = await result.json();
  return {result, body};
}
export async function loadCaseSystemReview(signal: AbortSignal) {
  const {result, body} = await response(fetch("/api/natori/admin/case-system?review=1", {cache:"no-store", signal}));
  const parsed=caseSystemReviewSchema.safeParse(body);
  if(!result.ok||!parsed.success)throw new Error("review_unavailable");
  return parsed.data;
}
export async function submitCaseSystemControl(input:CaseSystemControlInput) {
  const {result,body}=await response(fetch("/api/natori/admin/case-system",{method:"POST",cache:"no-store",
    headers:{"Content-Type":"application/json","x-requested-with":"me-ish"},body:JSON.stringify(input)}));
  if(!result.ok||!body||typeof body!=="object"||!("result" in body)||body.result!=="saved")throw new Error("control_unconfirmed");
}
