/** 発行済み見積もりに固定する、依頼者向けの制作条件。 */
export type NatoriQuoteTerms = {
  deliverables: string;
  dueDate: string;
  scope?: string;
  usage?: string;
  commercialUse?: string;
  publication?: string;
};

export function isValidQuoteDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function readNatoriQuoteTerms(value: unknown): NatoriQuoteTerms | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const terms = value as Record<string, unknown>;
  if (
    typeof terms.deliverables !== "string" ||
    !terms.deliverables.trim() ||
    terms.deliverables.length > 1000 ||
    typeof terms.dueDate !== "string" ||
    !isValidQuoteDate(terms.dueDate)
  ) return null;
  const optional = (key: "scope" | "usage" | "commercialUse" | "publication") =>
    typeof terms[key] === "string" && terms[key].trim() && terms[key].length <= 300
      ? terms[key].trim() : undefined;
  return {
    deliverables: terms.deliverables.trim(), dueDate: terms.dueDate,
    scope: optional("scope"), usage: optional("usage"),
    commercialUse: optional("commercialUse"), publication: optional("publication"),
  };
}

export function formatQuoteDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}
