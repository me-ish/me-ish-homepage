import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ESTIMATE_ASSISTANT_SYSTEM_PROMPT,
  buildEstimateAssistantDraft,
  buildEstimateAssistantPrompt,
  estimateAssistantOutputSchema,
  type EstimateAssistantMessage,
} from "@/features/natori/lib/estimateAssistant";
import type { NatoriEstimateDraft } from "@/features/natori/lib/estimateDraft";
import { createPortfolioStructuredPricingConfig } from "@/features/natori/lib/portfolioPricing";
import { readNatoriProjectType } from "@/features/natori/lib/projectReadModel";
import { readNatoriRequestData } from "@/features/natori/lib/requestSchema";
import type { NatoriDeliveryPlan } from "@/features/natori/types/projects";
import { readEstimateDraftForOwner, writeEstimateDraftForOwner } from "@/features/natori/server/estimateDraftService";
import { loadPortfolioContent } from "@/features/natori/server/portfolioSiteService";

const MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 60;
const MAX_MESSAGE_CHARS = 2000;

export type EstimateAssistantResult =
  | { kind: "ok"; draft: NatoriEstimateDraft }
  | { kind: "disabled" | "not-found" | "invalid-state" | "conflict" | "skipped" | "unreadable" | "ai-error" | "db-error" };

/** Off unless explicitly enabled, so a missing key never changes today's screens. */
export function estimateAssistantEnabled(): boolean {
  return process.env.NATORI_ASSISTANT_ENABLED === "1" && Boolean(process.env.ANTHROPIC_API_KEY);
}

function todayInTokyo(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function nowLabelInTokyo(): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
}

/** Message bodies and who wrote them only: no names, addresses, times or file links leave the server. */
async function readTalk(projectId: string): Promise<EstimateAssistantMessage[] | null> {
  const { data, error } = await supabaseAdmin().from("natori_consultation_messages")
    .select("sender, body").eq("project_id", projectId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(MAX_MESSAGES);
  if (error) return null;
  return (data ?? []).reverse()
    .filter((row) => (row.sender === "client" || row.sender === "staff") && typeof row.body === "string" && row.body.trim())
    .map((row) => ({ sender: row.sender as "client" | "staff", body: row.body.slice(0, MAX_MESSAGE_CHARS) }));
}

/**
 * Reads the request (and the talk, if any), asks Claude to read it, and stores the result as the
 * estimate draft. `expectedRevision` 0 only creates a draft when none exists; a positive revision
 * replaces that exact draft. Issuing and sending the quote stay with Natori.
 */
export async function runEstimateAssistant(ownerId: string, projectId: string, expectedRevision: number): Promise<EstimateAssistantResult> {
  if (!estimateAssistantEnabled()) return { kind: "disabled" };
  const current = await readEstimateDraftForOwner(ownerId, projectId);
  if (current.kind !== "ok") return current;
  if (current.editable === false) return { kind: "invalid-state" };
  if ((current.draft?.revision ?? 0) !== expectedRevision) return expectedRevision === 0 ? { kind: "skipped" } : { kind: "conflict" };

  const { data: project, error } = await supabaseAdmin().from("natori_projects")
    .select("type, delivery_plan, due_date, request_data").eq("id", projectId).eq("user_id", ownerId).maybeSingle();
  if (error) return { kind: "db-error" };
  if (!project) return { kind: "not-found" };
  const request = readNatoriRequestData(project.request_data);
  if (!request.success) return { kind: "unreadable" };
  const messages = await readTalk(projectId);
  if (!messages) return { kind: "db-error" };
  const pricingConfig = createPortfolioStructuredPricingConfig(await loadPortfolioContent());
  const view = {
    type: readNatoriProjectType(project.type),
    deliveryPlan: (project.delivery_plan ?? undefined) as NatoriDeliveryPlan | undefined,
    dueDate: project.due_date,
    requestData: project.request_data,
  };

  let output;
  try {
    const response = await new Anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(estimateAssistantOutputSchema) },
      system: ESTIMATE_ASSISTANT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildEstimateAssistantPrompt({
        requestData: request.data, projectType: view.type, dueDate: view.dueDate,
        messages, pricingConfig, today: todayInTokyo(),
      }) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      console.error("[natori-estimate-assistant] no_output", response.stop_reason);
      return { kind: "ai-error" };
    }
    output = response.parsed_output;
  } catch (cause) {
    console.error("[natori-estimate-assistant] request_failed", cause instanceof Anthropic.APIError ? cause.status : "network");
    return { kind: "ai-error" };
  }

  const draft = buildEstimateAssistantDraft({ project: view, requestData: request.data, output, pricingConfig, createdAt: nowLabelInTokyo() });
  const saved = await writeEstimateDraftForOwner(ownerId, projectId, expectedRevision, draft);
  if (saved.kind !== "ok" || !saved.draft) return saved.kind === "ok" ? { kind: "db-error" } : expectedRevision === 0 && saved.kind === "conflict" ? { kind: "skipped" } : saved;
  return { kind: "ok", draft: saved.draft };
}

/** After a new request is accepted: prepare a first draft in the background. Never blocks intake. */
export function scheduleEstimateAssistant(ownerId: string, projectId: string | null): void {
  if (!projectId || !estimateAssistantEnabled()) return;
  try {
    after(async () => {
      const result = await runEstimateAssistant(ownerId, projectId, 0);
      if (result.kind !== "ok" && result.kind !== "skipped") console.error("[natori-estimate-assistant] intake_draft_failed", result.kind);
    });
  } catch { console.error("[natori-estimate-assistant] scheduling_interrupted"); }
}
