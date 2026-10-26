import { CASE_SECTIONS, type CaseEntry, type CaseSection } from "../types/caseWorkspace";
import { isPaymentTimestamp } from "./clientPayment";

export type CaseWorkspaceLocation = {
  entry: CaseEntry; projectId: string | null; selectedId: string | null; section: CaseSection;
  query: string; filter: "all" | "staff" | "client" | "completed";
  source:"all"|"inquiries"|"estimate";sort:"default"|"due"|"priority";utility:"none"|"settings"|"estimate"|"pages";
  intakeFilter:"all"|"attention"|"rough-ok"|"ended"|"inquiry"|"estimating"|"quoted"|"awaiting_payment";
  date: string; month: string; noticeId: string | null; page:number;noticePage:number;historyPage?:number; mode: "normal" | "partial" | "failed";
};
export function parseCaseWorkspaceLocation(search: string, today = "2026-10-20"): CaseWorkspaceLocation {
  const p = new URLSearchParams(search);
  const entry = p.get("entry"), section = p.get("section"), filter = p.get("filter"), mode = p.get("mode");
  const id = (key: string) => { const value = p.get(key); return value && /^[a-zA-Z0-9-]{1,80}$/.test(value) ? value : null; };
  const date = p.get("date");
  const page=(key:string)=>{const v=p.get(key);return v&&/^[1-9]\d{0,6}$/.test(v)?Number(v):1;};
  return {
    // Old "today" links open the case list, which now leads with the staff's own turn.
    entry: entry === "schedule" || entry === "notifications" ? entry : "cases",
    projectId: id("case")??id("project")??id("inquiry"), selectedId: id("selected"),
    section: CASE_SECTIONS.includes(section as CaseSection) ? section as CaseSection : p.get("view")==="conversation"?"consultation":"overview",
    query: (p.get("q") ?? "").slice(0,100),
    filter: filter === "staff" || filter === "client" || filter === "completed" ? filter : "all",
    source:p.get("source")==="inquiries"||p.get("source")==="estimate"?p.get("source") as "inquiries"|"estimate":"all",
    sort:p.get("sort")==="due"||p.get("sort")==="priority"?p.get("sort") as "due"|"priority":"default",
    utility:p.get("utility")==="settings"||p.get("utility")==="estimate"||p.get("utility")==="pages"?p.get("utility") as "settings"|"estimate"|"pages":"none",
    intakeFilter:["attention","rough-ok","ended","inquiry","estimating","quoted","awaiting_payment"].includes(p.get("intakeFilter")??p.get("filter")??"")?(p.get("intakeFilter")??p.get("filter")) as CaseWorkspaceLocation["intakeFilter"]:"all",
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) && isPaymentTimestamp(`${date}T00:00:00Z`) ? date : today,
    month: /^\d{4}-\d{2}$/.test(p.get("month")??"") && isPaymentTimestamp(`${p.get("month")}-01T00:00:00Z`)
      ? p.get("month")! : (date && isPaymentTimestamp(`${date}T00:00:00Z`) ? date : today).slice(0,7),
    noticeId: id("notice") ?? (/^legacy-mail:[a-zA-Z0-9-]{1,80}$/.test(p.get("notice")??"") ? p.get("notice") : null),
    page:page("page"),noticePage:page("noticePage"),historyPage:page("historyPage"),
    mode: mode === "partial" || mode === "failed" ? mode : "normal",
  };
}
/** Caller supplies a fixed app/preview path; no arbitrary return URL or capability. */
export function caseWorkspaceHref(location: CaseWorkspaceLocation, basePath = "/"): string {
  const p = new URLSearchParams({ entry: location.entry, section: location.section, date: location.date, month: location.month, mode: location.mode });
  if (location.projectId) p.set("case",location.projectId);
  if (location.selectedId) p.set("selected",location.selectedId);
  if (location.noticeId) p.set("notice",location.noticeId);
  if(location.page>1)p.set("page",String(location.page));
  if(location.noticePage>1)p.set("noticePage",String(location.noticePage));
  if((location.historyPage??1)>1)p.set("historyPage",String(location.historyPage));
  if (location.query) p.set("q",location.query);
  if(location.source!=="all")p.set("source",location.source);
  if(location.sort!=="default")p.set("sort",location.sort);
  if(location.utility!=="none")p.set("utility",location.utility);
  if(location.intakeFilter!=="all")p.set("intakeFilter",location.intakeFilter);
  if (location.filter !== "all") p.set("filter",location.filter);
  return `${basePath}?${p}`;
}
