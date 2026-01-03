// ============================================
// aiPortfolio.generate.ts
// （高速化・軽量プロンプト版：LayoutDecision＋preset対応＋STEP3 sections対応）
//
// ・AI強度0% → designAnswers を忠実に採用（揺らぎゼロ）
// ・AI強度20〜60% → worldview / pattern / surface / layout を条件付き乱択
// ・AI強度高 → 大胆にシャッフル
// ・背景色には「好きな色」を使わず、accent ＋ 背景柄用の色にのみ使用
// ・worldviewPreset から bgGradient / patternLayers / textureLayers / bgStyle を注入
// ・LayoutDecision.decideLayout の sectionOrder でセクション並びを制御
// ・OpenAIリライトは軽量プロンプト化し、AI強度とAPIキーがある場合のみ実行
// ・時間ログつき（Date.now ベース）
// ・STEP3 sections フラグと整合性をとり、hero/on/off などが正しく効く
// ・CTAは廃止（cta section / contact.cta は生成しない）
// ============================================

import OpenAI from "openai";
import type { FormInput, Design, Content } from "./aiPortfolio.schema";
import { FormInputSchema, ContentSchema, DesignSchema } from "./aiPortfolio.schema";
import { deriveVariantFromAnswers } from "./aiPortfolio.variant";
import type { VariantSpec } from "./aiPortfolio.variant.base";
import { getWorldviewPreset } from "./aiPortfolio.worldviewPresets";
import { decideLayout } from "./aiPortfolio.layout";
import { getAllPatternIds } from "./aiPortfolio.patternRegistry";
import { auraAssetProxyUrl } from "./storage/auraAssets";


/* ---------------------------------------------------------
 * OpenAI Client（高速＋安定構成）
 * --------------------------------------------------------- */
let client: OpenAI | null = null;

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");

  if (!client) {
    client = new OpenAI({
      apiKey: key,
      timeout: 10_000, // 10秒で強制終了（UX優先）
      maxRetries: 1, // 一瞬のネットワーク揺れだけリカバリ
    });
  }
  return client;
}

/* ---------------------------------------------------------
 * Worldview → カラーパレット
 *  presets 側を単純な Palette 形式にアダプト
 * --------------------------------------------------------- */
type Palette = {
  primary: string;
  accent: string;
  bg: string;
  text: string;
};

function getPalette(worldview: VariantSpec["worldview"]): Palette {
  const preset = getWorldviewPreset(worldview as any);
  return {
    primary: (preset as any).colorPrimary ?? "#111827",
    accent: (preset as any).colorAccent ?? "#00a1e9",
    bg: (preset as any).colorBG ?? "#f3f4f6",
    text: (preset as any).colorText ?? "#111827",
  };
}

/* ---------------------------------------------------------
 * セクション順のベース定義（CTA廃止）
 * --------------------------------------------------------- */
const SECTION_ORDER: { type: string; order: number }[] = [
  { type: "hero", order: 10 },
  { type: "about", order: 20 },
  { type: "works", order: 30 },
  { type: "services", order: 40 },
  { type: "skills", order: 50 },
  { type: "contact", order: 60 },
];

/* ---------------------------------------------------------
 * AI強度のまとめ値を算出（overall が 0 の場合は他項目から平均）
 * --------------------------------------------------------- */
function calcOverallStrength(ai: any | undefined): number {
  if (!ai) return 0;

  const o = typeof ai.overall === "number" ? ai.overall : 0;
  if (o > 0) return o;

  const keys = ["color", "pattern", "surface", "layout", "copywriting", "structure"];
  const vals = keys.map((k) => (typeof ai[k] === "number" ? (ai[k] as number) : 0));
  const sum = vals.reduce((a, b) => a + b, 0);
  const avg = sum / (vals.length || 1);

  return avg; // 0〜100
}

/* ---------------------------------------------------------
 * UI Profile（質感トークン）: AI強度で参照レンジを切り替える
 * - 0-20: base固定（白枠・角）
 * - 20-60: worldview忠実（deriveVariant結果を尊重）
 * - 60-99: 近接worldviewのprofileを参照
 * - 100: 全worldviewからprofile参照
 * ※ worldview自体は変えず、radius/shadow/surfaceだけ上書きする（破綻防止）
 * --------------------------------------------------------- */

type UiProfile = {
  radius?: string; // resolveRadius で解釈される値（"md" 等OK）
  shadow?: string; // resolveShadow で拾われる or 生のbox-shadow文字列
  surface?: VariantSpec["surface"]; // "paper" | "glass" | "dark" | "neon" | "card"
};

const UI_PROFILE_BASE: UiProfile = {
  // 「角枠の白枠」＝ paper + 角寄り
  surface: "paper",
  radius: "md",
  shadow: "0 14px 32px rgba(15,23,42,0.12)",
};

const UI_PROFILE_BY_WORLDVIEW: Record<string, UiProfile> = {
  minimal: { surface: "paper", radius: "md" },
  modern: { surface: "card", radius: "lg" },
  business: { surface: "paper", radius: "md" },
  cute: { surface: "paper", radius: "xl" },
  pop: { surface: "card", radius: "lg" },
  natural: { surface: "paper", radius: "lg" },
  retro: { surface: "paper", radius: "md" },
  luxury: { surface: "dark", radius: "lg" },
  cyber: { surface: "neon", radius: "lg" },
  dark: { surface: "dark", radius: "lg" },
};

// 近接（必要に応じて後であなたの「世界観グラフ」に差し替え）
const WORLDVIEW_ADJACENT: Record<string, string[]> = {
  minimal: ["modern", "business"],
  modern: ["minimal", "business", "pop"],
  business: ["minimal", "modern", "luxury"],
  cute: ["pop", "natural"],
  pop: ["cute", "modern", "cyber"],
  natural: ["cute", "retro", "minimal"],
  retro: ["natural", "luxury", "business"],
  luxury: ["business", "retro", "dark"],
  cyber: ["pop", "dark"],
  dark: ["cyber", "luxury"],
};

function hashToUnit(seed: string): number {
  // 安定乱数（0..1）
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // 0..1
  return (h >>> 0) / 4294967295;
}

function pickStable<T>(arr: T[], seed: string): T {
  const u = hashToUnit(seed);
  const idx = Math.min(arr.length - 1, Math.floor(u * arr.length));
  return arr[idx];
}

function applyUiProfileToVariant(
  variant: VariantSpec,
  payload: FormInput,
  overallStrength: number,
) {
  const baseWorldview = variant.worldview as string;

  // セッション固定 seed（requestIdが無いので、email/nameで近似固定）
  const seed =
    `${payload.email ?? ""}__${payload.name ?? ""}__${(payload as any).title ?? ""}` ||
    `fallback__${Date.now()}`;

  // 0-20: base固定
  if (overallStrength <= 20) {
    (variant as any).surface = UI_PROFILE_BASE.surface ?? variant.surface;
    (variant as any).radius = UI_PROFILE_BASE.radius ?? (variant as any).radius;
    (variant as any).shadow = UI_PROFILE_BASE.shadow ?? (variant as any).shadow;
    return;
  }

  // 20-60: worldview忠実（何もしない、ただし「worldviewごとの下駄」は任意）
  if (overallStrength <= 60) {
    const p = UI_PROFILE_BY_WORLDVIEW[baseWorldview];
    if (p) {
      // 忠実帯なので “上書き” ではなく、未指定の穴埋めだけ
      if (!(variant as any).surface && p.surface) (variant as any).surface = p.surface;
      if (!(variant as any).radius && p.radius) (variant as any).radius = p.radius;
      if (!(variant as any).shadow && p.shadow) (variant as any).shadow = p.shadow;
    }
    return;
  }

  // 60-99: 近接参照（radius/surface/shadow の “まとまり” を1セットだけ持ってくる）
  const candidates =
    (WORLDVIEW_ADJACENT[baseWorldview] && WORLDVIEW_ADJACENT[baseWorldview].length > 0)
      ? WORLDVIEW_ADJACENT[baseWorldview]
      : Object.keys(UI_PROFILE_BY_WORLDVIEW);

  // 100: 全世界観
  const pickPool = overallStrength >= 100 ? Object.keys(UI_PROFILE_BY_WORLDVIEW) : candidates;

  const pickedWorldview = pickStable(pickPool, `uiProfile__${seed}__${overallStrength}`);
  const prof = UI_PROFILE_BY_WORLDVIEW[pickedWorldview] ?? UI_PROFILE_BY_WORLDVIEW[baseWorldview];

  if (prof?.surface) (variant as any).surface = prof.surface;
  if (prof?.radius) (variant as any).radius = prof.radius;
  if (prof?.shadow) (variant as any).shadow = prof.shadow;

  // 参考ログ（必要なら残す）
  console.log("[UI_PROFILE] base=", baseWorldview, "picked=", pickedWorldview, "strength=", overallStrength);
}


/* ---------------------------------------------------------
 * STEP3: Services に中身があるかどうか判定
 * --------------------------------------------------------- */
function hasServiceContent(payload: FormInput): boolean {
  const raw =
    ((payload as any).services ?? (payload as any).offerings) as
      | { label?: string | null; name?: string | null }[]
      | undefined;

  if (!raw) return false;

  return raw.some((o) => {
    const label = (o?.label ?? o?.name ?? "").trim();
    return label.length > 0;
  });
}

/* ---------------------------------------------------------
 * STEP3: セクション有効判定
 * --------------------------------------------------------- */
function isSectionEnabled(type: string, payload: FormInput): boolean {
  const flags = (payload as any).sections as
    | {
        hero?: boolean;
        about?: boolean;
        works?: boolean;
        services?: boolean;
        skills?: boolean;
        contact?: boolean;
      }
    | undefined;

  if (!flags) {
    if (type === "services") return hasServiceContent(payload);
    return true;
  }

  const raw = (flags as any)[type];
  const flagOn = raw === true;

  if (!flagOn) return false;

  if (type === "services") return hasServiceContent(payload);

  return true;
}

/* ---------------------------------------------------------
 * Design.sections の自動構築
 *   - LayoutDecision.sectionOrder を優先
 *   - STEP3 sections と整合
 * --------------------------------------------------------- */
function buildDefaultDesignSections(payload: FormInput, sectionOrder?: string[]): Design["sections"] {
  const list: Design["sections"] = [];

  const orderSource =
    sectionOrder && sectionOrder.length > 0 ? sectionOrder : SECTION_ORDER.map((s) => s.type);

  for (const type of orderSource) {
    const def = SECTION_ORDER.find((s) => s.type === type);
    if (!def) continue;
    if (!isSectionEnabled(type, payload)) continue;
    list.push({ type, order: def.order });
  }

  const flags = (payload as any).sections;

  if (list.length === 0 && !flags) {
    list.push({ type: "hero", order: 10 });
  }

  return list;
}

/* ---------------------------------------------------------
 * Content.sections（初期版）を構築
 * --------------------------------------------------------- */
function skillsToItems(payload: FormInput): any[] {
  const raw = (payload as any).skills;
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((v: any) => {
        if (typeof v === "string") return { label: v };
        return { label: v.label ?? "", level: v.level, category: v.category };
      })
      .filter((v) => v.label);
  }

  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => ({ label: s }));
  }

  return [];
}

function normalizeUrlLoose(v: string): string {
  const s = v.trim();
  if (!s) return s;
  if (/^mailto:/i.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  return `https://${s}`;
}

function cleanHandle(v: string): string {
  return v.trim().replace(/^@/, "");
}

function snsToUrl(label: string, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  // URL っぽいならそのまま（ただしスキーム無しは補完）
  if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v) || /^\/\//.test(v)) return normalizeUrlLoose(v);
  if (/[.]/.test(v) && !/^\w+$/.test(v)) return normalizeUrlLoose(v);

  const h = cleanHandle(v);
  if (!h) return null;

  if (label === "X") return `https://x.com/${h}`;
  if (label === "Instagram") return `https://www.instagram.com/${h}`;
  if (label === "Behance") return `https://www.behance.net/${h}`;

  return normalizeUrlLoose(v);
}

function buildDefaultContentSections(payload: FormInput, variant: VariantSpec): Content["sections"] {
  const sections: Content["sections"] = [];

  const toggles = (payload as any).sections ?? {};

  const name = payload.name;
  const role = (payload as any).role;
  const titleLegacy = (payload as any).title as string | undefined;
  const tagline = ((payload as any).tagline as string | null | undefined) ?? "";
  const bio = payload.bio;
  const email = payload.email;

  const avatarUrl = (payload as any).avatarUrl as string | undefined;

  /* ---------- hero ---------- */
  if (toggles.hero !== false) {
    const heroTitle = name || titleLegacy || "Your Name";
    const heroSubtitle = role || "";
    const heroDesc = tagline || bio || "";

    sections.push({
      type: "hero",
      title: heroTitle,
      subtitle: heroSubtitle || undefined,
      description: heroDesc || undefined,
      avatarUrl,
      headings: [heroTitle, heroSubtitle].filter(Boolean),
      paragraphs: [heroDesc],
    } as any);
  }

  /* ---------- about ---------- */
  if (toggles.about !== false) {
    sections.push({
      type: "about",
      headings: ["About"],
      paragraphs: [bio ?? ""],
    } as any);
  }

  /* ---------- works ---------- */
  if (toggles.works !== false) {
    const items =
      ((payload as any).images ?? [])
        .map((img: any, i: number) => {
          // 1) imageUrl/url を優先
          const rawUrl = (img?.imageUrl ?? img?.url ?? "").toString().trim();

          // 2) storagePath 系も救済（Uploaderの形式 / 互換）
          const rawStoragePath = (
            img?.storagePath ??
            img?.storage_path ??
            img?.path ??
            img?.filePath ??
            img?.file_path ??
            ""
          )
            .toString()
            .trim()
            .replace(/^\//, ""); // 念のため先頭スラッシュ除去

          // 3) 最終的な表示URL（空ならstoragePathから生成）
          const imageUrl = rawUrl || (rawStoragePath ? auraAssetProxyUrl(rawStoragePath) : "");

          // 4) year（number / string どちらでも受けて number に寄せる）
          const yearRaw = img?.year;
          const year =
            typeof yearRaw === "number"
              ? yearRaw
              : typeof yearRaw === "string" && yearRaw.trim()
                ? Number(yearRaw)
                : undefined;

          const safeYear = Number.isFinite(year as number) ? (year as number) : undefined;

          const title = (img?.title ?? img?.name ?? `作品 ${i + 1}`).toString();
          const description =
            typeof img?.description === "string" ? img.description : (img?.desc as string | undefined);

          return {
            imageUrl,
            title,
            description,
            year: safeYear,
            // 将来のために保持（schema側が許可していれば残る）
            storagePath: rawStoragePath || undefined,
          };
        })
        // imageUrl が空のものは ContentSchema で落ちやすいので除外
        .filter((it: any) => typeof it.imageUrl === "string" && it.imageUrl.trim().length > 0);


    sections.push({
      type: "works",
      headings: ["Works"],
      paragraphs: [],
      items,
    } as any);
  }

  /* ---------- services ---------- */
  if (toggles.services !== false && hasServiceContent(payload)) {
    const servicesRaw = (payload as any).services ?? (payload as any).offerings ?? [];

    const items = (servicesRaw as any[])
      .map((svc: any) => {
        const title = (svc.label ?? svc.name ?? "").toString().trim();
        if (!title) return null;

        const rawPrice =
          (svc.priceHint as string | number | undefined) ??
          (svc.price as string | number | undefined) ??
          "";

        const priceHint =
          rawPrice !== undefined && rawPrice !== null ? rawPrice.toString().trim() : "";

        const rawDesc =
          (svc.description as string | undefined) ?? (svc.desc as string | undefined) ?? "";

        const description = rawDesc ? rawDesc.toString().trim() : "";

        return {
          title,
          label: title, // 旧UI互換
          priceHint,
          price: priceHint || "", // 表示用
          description,
        };
      })
      .filter(Boolean) as {
      title: string;
      label: string;
      priceHint?: string;
      description?: string;
    }[];

    if (items.length > 0) {
      sections.push({
        type: "services",
        headings: ["Services"],
        paragraphs: [],
        items,
      } as any);
    }
  }

  /* ---------- skills ---------- */
  if (toggles.skills !== false) {
    const items = skillsToItems(payload);
    sections.push({
      type: "skills",
      headings: ["Skills"],
      items,
    } as any);
  }

  /* ---------- contact（SNS反映 + CTA廃止） ---------- */
  if (toggles.contact !== false) {
    const mail = (email as string | undefined) || undefined;

    // 1) 配列形式 links / socialLinks / sns を拾う
    const rawLinksArrays: any[][] = [
      (((payload as any).links as any[]) ?? []) as any[],
      (((payload as any).socialLinks as any[]) ?? []) as any[],
      (((payload as any).sns as any[]) ?? []) as any[],
    ];

    // 2) ネスト形式 social を拾う（今回の本丸）
    const social = ((payload as any).social ?? {}) as Record<string, unknown>;

    // 3) 直下フィールド（互換）も拾う
    const direct = payload as any;

    const contactLinks: { label: string; href: string }[] = [];
    const seenHref = new Set<string>();

    const pushLink = (label?: string, href?: string) => {
      const l = (label ?? "").trim();
      const h0 = (href ?? "").trim();
      if (!l || !h0) return;

      const h = snsToUrl(l, h0);
      if (!h) return;

      if (seenHref.has(h)) return;
      seenHref.add(h);
      contactLinks.push({ label: l, href: h });
    };

    // 1) メールは pill 側で表示する想定だが、links にも入れておく（重複はフロントで除去可能）
    if (mail) pushLink(mail, `mailto:${mail}`);

    // 2) 配列リンク
    for (const arr of rawLinksArrays) {
      for (const item of arr) {
        if (!item) continue;
        const label = (item.label as string | undefined) ?? (item.name as string | undefined);
        const href = (item.href as string | undefined) ?? (item.url as string | undefined);
        pushLink(label, href);
      }
    }

    // 3) social ネスト（フォームの実データ）
    // ※ handleだけでもOK（X/Instagram/BehanceはURL化）
    pushLink("X", (social.twitter as string | undefined) ?? (social.x as string | undefined));
    pushLink("Instagram", social.instagram as string | undefined);
    pushLink("Behance", social.behance as string | undefined);
    pushLink("Website", social.website as string | undefined);
    pushLink("pixiv", social.pixiv as string | undefined);
    pushLink("Skeb", social.skeb as string | undefined);
    pushLink("BOOTH", social.booth as string | undefined);

    // 4) 直下（互換）
    const snsFieldCandidates: { key: string; label: string }[] = [
      { key: "xUrl", label: "X" },
      { key: "twitterUrl", label: "X" },
      { key: "twitter", label: "X" },
      { key: "tw", label: "X" },

      { key: "instagramUrl", label: "Instagram" },
      { key: "instagram", label: "Instagram" },
      { key: "ig", label: "Instagram" },

      { key: "behanceUrl", label: "Behance" },
      { key: "behance", label: "Behance" },
      { key: "be", label: "Behance" },

      { key: "pixivUrl", label: "pixiv" },
      { key: "pixiv", label: "pixiv" },

      { key: "skebUrl", label: "Skeb" },
      { key: "skeb", label: "Skeb" },

      { key: "boothUrl", label: "BOOTH" },
      { key: "booth", label: "BOOTH" },

      { key: "websiteUrl", label: "Website" },
      { key: "siteUrl", label: "Website" },
      { key: "portfolioUrl", label: "Website" },
      { key: "site", label: "Website" },
    ];

    for (const { key, label } of snsFieldCandidates) {
      const value = direct[key] as string | undefined;
      if (!value) continue;
      pushLink(label, value);
    }

    sections.push({
      type: "contact",
      headings: ["Contact"],
      paragraphs: ["ご依頼・ご相談は、以下からお気軽にご連絡ください。"],
      description: "ご依頼・ご相談は、以下からお気軽にご連絡ください。",
      email: mail,
      // ✅ Renderer側で social ネストも拾えるように保持（今回の対応で表示される）
      social: Object.keys(social).length > 0 ? social : undefined,
      links: contactLinks.length > 0 ? contactLinks : undefined,
    } as any);
  }

  /* ---------- フォールバック ---------- */
  if (sections.length === 0) {
    const heroTitle = name || titleLegacy || "Your Name";
    sections.push({
      type: "hero",
      title: heroTitle,
      description: tagline || "",
      headings: [heroTitle],
      paragraphs: [tagline || ""],
    } as any);
  }

  return sections;
}

/* ---------------------------------------------------------
 * Content.sections を LayoutDecision.sectionOrder に従って並び替え
 * --------------------------------------------------------- */
function applySectionOrderToContent(sections: Content["sections"], sectionOrder: string[] | undefined): Content["sections"] {
  if (!sectionOrder || sectionOrder.length === 0) return sections;

  const orderMap = new Map<string, number>();
  sectionOrder.forEach((t, idx) => orderMap.set(t, idx));

  return [...sections].sort((a: any, b: any) => {
    const oa = orderMap.has(a.type) ? orderMap.get(a.type)! : 999;
    const ob = orderMap.has(b.type) ? orderMap.get(b.type)! : 999;
    if (oa === ob) return 0;
    return oa - ob;
  });
}

/* ---------------------------------------------------------
 * OpenAI に渡す用に section を圧縮（★単体版）
 * --------------------------------------------------------- */
function buildCompactSectionForAI(section: any) {
  const maxItemsPerSection = 12;

  const trim = (s: unknown, max: number): string | undefined => {
    if (typeof s !== "string") return undefined;
    const t = s.trim();
    if (!t) return undefined;
    return t.length > max ? t.slice(0, max) : t;
  };

  const compact: any = { type: section.type };

  if (section.type === "hero") {
    const t = trim(section.title, 120);
    const st = trim(section.subtitle, 120);
    const d = trim(section.description, 400);

    if (t) compact.title = t;
    if (st) compact.subtitle = st;
    if (d) compact.description = d;

    if (typeof section.avatarUrl === "string" && section.avatarUrl.trim()) {
      compact.avatarUrl = section.avatarUrl.trim();
    }
  }

  if (section.headings && section.headings.length > 0) {
    compact.headings = section.headings.map((h: string) => trim(h, 120)).filter(Boolean);
  }

  if (section.paragraphs && section.paragraphs.length > 0) {
    compact.paragraphs = section.paragraphs.map((p: string) => trim(p, 400)).filter(Boolean);
  }

  if (section.items && section.items.length > 0) {
    compact.items = section.items.slice(0, maxItemsPerSection).map((item: any) => ({
      title: trim(item.title, 120),
      description: trim(item.description, 400),
    }));
  }

  // CTAは廃止だが、万一残っていてもlabelだけ整形する程度なら害は少ないため保持
  if (section.cta) {
    compact.cta = { label: trim(section.cta.label, 80) };
  }

  return compact;
}

async function refineContentWithOpenAI(payload: FormInput, design: Design, draftContent: Content): Promise<Content> {
  const openai = getClient();
  const model = process.env.AIPORTFOLIO_MODEL ?? "gpt-4o-mini";

  const strengthOverall = ((payload as any).aiStrength?.overall ?? 0) / 100;
  const rewriteLevel = Math.min(1, 0.3 + 0.7 * strengthOverall);

  const worldview = (payload as any).designAnswers?.worldviewBase || "minimal";
  const toneRaw = (payload as any).tone as string | undefined;
  const tone =
    toneRaw === "フレンドリー"
      ? "フレンドリー（やわらかめ・少し口語・短めの文・丁寧さは維持、語尾にバリエーション）"
      : "丁寧（ですます調・落ち着き・端的）";

  // ★ 対象は hero/about/services のみ（CTA廃止のため cta は対象外）
  const TARGET_TYPES = new Set(["hero", "about", "services"]);

  const indexed = (draftContent.sections ?? []).map((s, idx) => ({ s, idx }));
  const targets = indexed.filter(({ s }: any) => TARGET_TYPES.has(s?.type));

  if (targets.length === 0) return draftContent;

  const systemPrompt =
    "あなたはポートフォリオサイトの文章を整える日本語コピーライターです。" +
    "構造（type/items/ctaなど）を変えすぎない範囲で、見出しと文章だけを自然な日本語に整えてください。" +
    "必ず JSON だけ出力し、余分な文章は書かないこと。" +
    '出力形式は { "sections": [...] } です。';

  const compactSections = targets.map(({ s }: any) => buildCompactSectionForAI(s));

  const userPrompt =
    `世界観: ${worldview}\n` +
    `トーン: ${tone}\n` +
    `rewriteLevel(0-1): ${rewriteLevel.toFixed(2)}\n` +
    `名前: ${payload.name ?? ""}\n` +
    `肩書き: ${(payload as any).role ?? ""}\n` +
    `キャッチコピー: ${((payload as any).tagline as string | null | undefined) ?? ""}\n` +
    `自己紹介: ${payload.bio ?? ""}\n\n` +
    "以下の sections を上記の世界観に沿って自然に整えてください。\n" +
    "構造（type / items / cta など）は変えず、" +
    "hero セクションは title / subtitle / description もリライト対象です。\n" +
    "その他は headings / paragraphs / items[].title / items[].description  を中心にリライトしてください。\n" +
    "出力は必ず { \"sections\": [ ... ] } の JSON のみ。\n\n" +
    "文体ルール:\n" +
    "- フレンドリー: ですますを維持してもよいが、硬さを抜き、語尾とリズムに揺れを作る（例: 〜です/〜ます/〜できます/〜です！など）。\n" +
    "- 丁寧: ですます調で統一し、過度な感嘆符や口語を避ける。\n" +
    "- どちらも敬語崩壊はNG。馴れ馴れしすぎない。\n" +
    JSON.stringify({ sections: compactSections });

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2 + 0.7 * rewriteLevel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices[0].message.content ?? "";

    let parsed: any = null;
    try {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      const json = start >= 0 && end > start ? text.slice(start, end + 1) : text;
      parsed = JSON.parse(json);
    } catch {
      return draftContent;
    }

    const refinedSections = Array.isArray(parsed?.sections) ? parsed.sections : null;
    if (!refinedSections) return draftContent;

    const refinedByType = new Map<string, any>();
    for (const rs of refinedSections) {
      if (rs?.type && typeof rs.type === "string") refinedByType.set(rs.type, rs);
    }

    const out = [...(draftContent.sections ?? [])] as any[];

    for (const { s, idx } of targets as any[]) {
      const r = refinedByType.get(s.type);
      if (!r || r.type !== s.type) continue;
      out[idx] = mergeTextFieldsIntoSection(s, r);
    }

    return { ...draftContent, sections: out as any };
  } catch {
    return draftContent;
  }
}

function mergeTextFieldsIntoSection(original: any, refined: any) {
  const out = { ...original };

  if (Array.isArray(refined?.headings)) out.headings = refined.headings;
  if (Array.isArray(refined?.paragraphs)) out.paragraphs = refined.paragraphs;

  if (original?.type === "hero") {
    if (typeof refined?.title === "string" && refined.title.trim()) {
      out.title = refined.title.trim();
    } else if (Array.isArray(refined?.headings) && typeof refined.headings[0] === "string") {
      out.title = refined.headings[0].trim();
    }

    if (typeof refined?.subtitle === "string" && refined.subtitle.trim()) {
      out.subtitle = refined.subtitle.trim();
    } else if (Array.isArray(refined?.headings) && typeof refined.headings[1] === "string") {
      out.subtitle = refined.headings[1].trim();
    }

    if (typeof refined?.description === "string" && refined.description.trim()) {
      out.description = refined.description.trim();
    } else if (Array.isArray(refined?.paragraphs) && typeof refined.paragraphs[0] === "string") {
      out.description = refined.paragraphs[0].trim();
    }

    if (typeof original?.avatarUrl === "string" && original.avatarUrl.trim()) {
      out.avatarUrl = original.avatarUrl.trim();
    }
  }

  if (Array.isArray(original?.items) && Array.isArray(refined?.items)) {
    out.items = original.items.map((origItem: any, idx: number) => {
      const refItem = refined.items[idx];
      if (!refItem) return origItem;

      return {
        ...origItem,
        ...(typeof refItem.title === "string" ? { title: refItem.title } : {}),
        ...(typeof refItem.description === "string" ? { description: refItem.description } : {}),
      };
    });
  }

  if (original?.cta && refined?.cta && typeof refined.cta.label === "string") {
    out.cta = { ...original.cta, label: refined.cta.label };
  }

  return out;
}

/* ---------------------------------------------------------
 * メイン：フォーム入力 → デザイン＋内容生成
 * --------------------------------------------------------- */
export async function generatePortfolioFromForm(rawPayload: unknown): Promise<{ design: Design; content: Content }> {
  const t0 = Date.now();
  let tp = t0;
  console.log("⏱ [GEN0] start generate");

  // ✅ 0) Zod parse で落ちる/消える可能性がある付加情報を先に拾う
  const rawAvatarUrl =
    rawPayload &&
    typeof rawPayload === "object" &&
    typeof (rawPayload as any).avatarUrl === "string" &&
    (rawPayload as any).avatarUrl.trim()
      ? (rawPayload as any).avatarUrl.trim()
      : undefined;

// ✅ 0) Zod parse 前に social を退避（FormInputSchema が unknown keys を落とすため）
const rawSocial =
  rawPayload &&
  typeof rawPayload === "object" &&
  (rawPayload as any).social &&
  typeof (rawPayload as any).social === "object"
    ? (rawPayload as any).social
    : undefined;

// 1) Zod parse（FormInput はしっかり見る）
const parsedResult = FormInputSchema.safeParse(rawPayload);
if (!parsedResult.success) {
  console.error("[GEN1] FormInputSchema error:", parsedResult.error);
  throw new Error("invalid_form_input");
}

// ✅ parse 後に avatarUrl / social を戻す
const payload: FormInput & { avatarUrl?: string; social?: any } = {
  ...parsedResult.data,
  avatarUrl: rawAvatarUrl,
  social: rawSocial,
};


  console.log(`⏱ [GEN1] after Zod parse: ${Date.now() - tp} ms`);
  tp = Date.now();

  const variant: VariantSpec = deriveVariantFromAnswers(payload as any);
  console.log(`⏱ [GEN2] after variant: ${Date.now() - tp} ms`);
  tp = Date.now();
    console.log("### RAW SOCIAL (after parse restore)", (payload as any).social);
  

  console.log("### VARIANT DEBUG", {
    id: (variant as any).id,
    worldview: variant.worldview,
    surface: variant.surface,
    layout: variant.layout,
    pattern: variant.pattern,
    radius: (variant as any).radius,
    shadow: (variant as any).shadow,
  });
  console.log("### AI STRENGTH", (payload as any).aiStrength);
  console.log("### DESIGN ANSWERS", (payload as any).designAnswers);
  console.log("### AVATAR URL", (payload as any).avatarUrl);

  // 2.5) LayoutDecision
  const imagesCount = (payload.images?.length ?? 0) as number;
  const bioLength = (payload.bio ?? "").length;
  const taglineRaw = ((payload as any).tagline as string | null | undefined) ?? "";
  const taglineLength = taglineRaw.length;

  const activeTypes = SECTION_ORDER.filter((s) => isSectionEnabled(s.type, payload)).map((s) => s.type);
  const activeSectionsCount = activeTypes.length;

  const layoutStrength = (payload as any).aiStrength?.layout ?? 0;
  const baseLayout = (variant.layout as any) === "split" ? "split" : "center";

  const layoutDecision = decideLayout({
    baseLayout,
    layoutStrength,
    imagesCount,
    bioLength,
    taglineLength,
    activeSectionsCount,
    hasFeatured: false,
  } as any);

  console.log("### LAYOUT DECISION", layoutDecision);

  // 3) テーマ色 ＋ worldviewPreset
  const palette = getPalette(variant.worldview);
  const worldviewPreset = getWorldviewPreset(variant.worldview as any);

  const userColorRaw = (payload as any).color as string | undefined;
  const favoriteColors = (payload as any).favoriteColors as { hex: string; weight?: number }[] | undefined;
  const favoriteHex = favoriteColors?.[0]?.hex;

  const userColor = (userColorRaw || favoriteHex || "").trim();
  const accent = userColor || palette.accent;
  const patternColor = userColor || palette.primary;

  const userPatternBase = (payload as any).designAnswers?.patternBase || undefined;
  const hasUserPattern = !!userPatternBase;

  const primaryPattern: string =
    (userPatternBase as string | undefined) ||
    ((variant.pattern as unknown) as string | undefined) ||
    ((worldviewPreset as any).patternBase as string | undefined) ||
    "none";

  const overallStrength = calcOverallStrength((payload as any).aiStrength);

    // ✅ UI Profile（質感）を AI強度レンジで適用
  applyUiProfileToVariant(variant, payload, overallStrength);


  const presetPatternLayers: string[] = ((worldviewPreset as any).patternLayers as string[] | undefined) ?? [];

  const allPatternPool = getAllPatternIds()
    .map((p) => String(p))
    .filter((p) => p && p !== "none")
    .filter((p) => !p.startsWith("texture-"));

  const pickUnique = (arr: string[], k: number): string[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.max(0, Math.min(k, a.length)));
  };

  const patternLayers: string[] = hasUserPattern
    ? primaryPattern === "none"
      ? []
      : [primaryPattern]
    : overallStrength >= 100
      ? pickUnique(allPatternPool, 2)
      : presetPatternLayers.length > 0
        ? presetPatternLayers
        : primaryPattern === "none"
          ? []
          : [primaryPattern];

  const presetTextureLayers: string[] = ((worldviewPreset as any).textureLayers as string[] | undefined) ?? [];
  const bgStyle = (worldviewPreset as any).bgStyle;

  const designInput = {
    theme: {
      colorPrimary: palette.primary,
      colorAccent: accent,
      colorBG: palette.bg,
      colorText: palette.text,

      backgroundPattern: primaryPattern,
      patternColor,

      languageMode:
        (payload as any).designAnswers?.languageMode || (worldviewPreset as any).languageMode || "ja",
      fontPreset:
        (payload as any).designAnswers?.fontPreset || (worldviewPreset as any).fontPreset || "cleanJa",

      bgGradient: (worldviewPreset as any).bgGradient,
      patternLayers,
      textureLayers: presetTextureLayers,
      bgStyle,
    },
    variantId: (variant as any).id ?? "auto",
    sections: buildDefaultDesignSections(payload, layoutDecision.sectionOrder),
    layoutType: (layoutDecision as any).layoutType,
  };

  const designParsed = DesignSchema.safeParse(designInput);
  if (!designParsed.success) {
    console.error("[GEN3] DesignSchema error:", designParsed.error);
  }

  const design: Design & { variantSpec: VariantSpec; layoutDecision?: any } = {
    ...(designParsed.success ? designParsed.data : (designInput as Design)),
    variantSpec: variant,
    layoutDecision,
  };

  console.log(`⏱ [GEN3] design built: ${Date.now() - tp} ms`);
  tp = Date.now();

  // 4) draft content
  const rawSections = buildDefaultContentSections(payload, variant);
  const orderedSections = applySectionOrderToContent(rawSections as any, layoutDecision.sectionOrder);

  const contentInput: Content = { sections: orderedSections as any };

  const contentParsed = ContentSchema.safeParse(contentInput);
  if (!contentParsed.success) {
    console.error("[GEN4] ContentSchema error:", contentParsed.error);
  }

  const draftContent: Content = contentParsed.success ? contentParsed.data : contentInput;

  console.log("[DEBUG] content.sections", JSON.stringify(draftContent.sections, null, 2));
  console.log(`⏱ [GEN4] draft content built: ${Date.now() - tp} ms`);
  tp = Date.now();

  // 5) OpenAI で文章だけ軽く整える（条件付き）
  const hasApiKey = !!process.env.OPENAI_API_KEY;

  const rawCopywriting = (payload as any).aiStrength?.copywriting;

  const tone = (payload as any).tone as string | undefined;
  const wantsFriendly = tone === "フレンドリー";

  const threshold = Number(process.env.AIPORTFOLIO_COPY_THRESHOLD ?? "20");

  const copyStrengthBase = typeof rawCopywriting === "number" && rawCopywriting > 0 ? rawCopywriting : overallStrength;

  const copyStrength = wantsFriendly ? Math.max(copyStrengthBase, threshold) : copyStrengthBase;

  const shouldUseAI = copyStrength >= threshold && hasApiKey;

  let finalContent = draftContent;

  console.log("[GEN5] strengths:", {
    overallStrength,
    rawCopywriting,
    copyStrength,
    threshold,
    hasApiKey,
    shouldUseAI,
  });

  if (shouldUseAI) {
    console.log(`⏱ [GEN5] refineContent start (copy=${copyStrength})`);
    try {
      finalContent = await refineContentWithOpenAI(payload, design, draftContent);
      console.log(`⏱ [GEN5] refineContent finished in ${Date.now() - tp} ms`);
    } catch (e) {
      console.error("[GEN5] refineContent error:", e);
      finalContent = draftContent;
    }
  } else {
    console.log(`⏱ [GEN5] skip refineContent (copy=${copyStrength}, hasApiKey=${hasApiKey})`);
  }

  console.log(`⏱ [GEN6] total: ${Date.now() - t0} ms`);

  return { design, content: finalContent };
}
