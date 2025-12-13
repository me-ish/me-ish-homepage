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
// ============================================

import OpenAI from "openai";
import type { FormInput, Design, Content } from "./aiPortfolio.schema";
import {
  FormInputSchema,
  ContentSchema,
  DesignSchema,
} from "./aiPortfolio.schema";
import { deriveVariantFromAnswers } from "./aiPortfolio.variant";
import type { VariantSpec } from "./aiPortfolio.variant.base";
import { getWorldviewPreset } from "./aiPortfolio.worldviewPresets";
import { decideLayout } from "./aiPortfolio.layout";

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
 * セクション順のベース定義
 * --------------------------------------------------------- */
const SECTION_ORDER: { type: string; order: number }[] = [
  { type: "hero", order: 10 },
  { type: "about", order: 20 },
  { type: "works", order: 30 },
  { type: "services", order: 40 },
  { type: "skills", order: 50 },
  { type: "contact", order: 60 },
  { type: "cta", order: 70 },
];

/* ---------------------------------------------------------
 * AI強度のまとめ値を算出（overall が 0 の場合は他項目から平均）
 * --------------------------------------------------------- */
function calcOverallStrength(ai: any | undefined): number {
  if (!ai) return 0;

  // overall が明示的に指定されていればそれを優先
  const o = typeof ai.overall === "number" ? ai.overall : 0;
  if (o > 0) return o;

  // 旧7項目から平均値を算出
  const keys = [
    "color",
    "pattern",
    "surface",
    "layout",
    "copywriting",
    "structure",
  ];
  const vals = keys.map((k) =>
    typeof ai[k] === "number" ? (ai[k] as number) : 0
  );
  const sum = vals.reduce((a, b) => a + b, 0);
  const avg = sum / (vals.length || 1);

  return avg; // 0〜100 を想定
}


/* ---------------------------------------------------------
 * STEP3: Services に中身があるかどうか判定
 * --------------------------------------------------------- */
function hasServiceContent(payload: FormInput): boolean {
  // services があれば優先。なければ offerings を見る。
  const raw =
    ((payload as any).services ??
      (payload as any).offerings) as
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
 *
 * - sections が undefined（旧データ） → 全部 ON（ただし services は中身必須）
 * - sections が存在する（新フォーム） → その type が true のものだけ ON
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
        cta?: boolean;
      }
    | undefined;

  // 旧レコード（sections 未送信）の場合は従来通り「全部 ON」扱い
  if (!flags) {
    if (type === "services") {
      return hasServiceContent(payload);
    }
    return true;
  }

  // 新レコード：明示的に true のものだけ ON
  const raw = (flags as any)[type];
  const flagOn = raw === true;

  if (!flagOn) return false;

  // services はフラグ ON でも中身ゼロなら OFF
  if (type === "services") {
    return hasServiceContent(payload);
  }

  return true;
}

/* ---------------------------------------------------------
 * Design.sections の自動構築
 *   - LayoutDecision.sectionOrder を優先
 *   - STEP3 sections と整合
 * --------------------------------------------------------- */
function buildDefaultDesignSections(
  payload: FormInput,
  sectionOrder?: string[]
): Design["sections"] {
  const list: Design["sections"] = [];

  const orderSource =
    sectionOrder && sectionOrder.length > 0
      ? sectionOrder
      : SECTION_ORDER.map((s) => s.type);

  for (const type of orderSource) {
    const def = SECTION_ORDER.find((s) => s.type === type);
    if (!def) continue;
    if (!isSectionEnabled(type, payload)) continue;
    list.push({ type, order: def.order });
  }

  const flags = (payload as any).sections;

  // sections が無い旧レコードだけ、空なら hero を 1 つ入れる（後方互換のため）
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
        if (typeof v === "string") {
          return { label: v };
        }
        return {
          label: v.label ?? "",
          level: v.level,
          category: v.category,
        };
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

function buildDefaultContentSections(
  payload: FormInput,
  variant: VariantSpec
): Content["sections"] {
  const sections: Content["sections"] = [];

  // ★ STEP3 のON/OFFフラグ
  const toggles = (payload as any).sections ?? {};

  const name = payload.name;
  const role = payload.role;
  const titleLegacy = (payload as any).title as string | undefined;
  const tagline =
    ((payload as any).tagline as string | null | undefined) ?? "";
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
      // ★ Schema に合わせて avatarUrl で渡す
      avatarUrl: avatarUrl,
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

  /* ---------- works（作品ギャラリー） ---------- */
  if (toggles.works !== false) {
    const items =
      (payload as any).images?.map((img: any, i: number) => {
        const url = img.imageUrl ?? img.url;
        return {
          imageUrl: url,
          title: img.title ?? img.name ?? `作品 ${i + 1}`,
          description: img.description,
        };
      }) ?? [];

    sections.push({
      type: "works",
      headings: ["Works"],
      paragraphs: [],
      items,
    } as any);
  }

  /* ---------- services（募集している仕事） ---------- */
  if (toggles.services !== false && hasServiceContent(payload)) {
    const servicesRaw =
      (payload as any).services ?? (payload as any).offerings ?? [];

    const items = (servicesRaw as any[])
      .map((svc: any) => {
        const title = (svc.label ?? svc.name ?? "").toString().trim();
        if (!title) return null;

        // 価格（フォーム上では price / priceHint を両方見る）
        const rawPrice =
          (svc.priceHint as string | number | undefined) ??
          (svc.price as string | number | undefined) ??
          "";

        const priceHint =
          rawPrice !== undefined && rawPrice !== null
            ? rawPrice.toString().trim()
            : "";

        // サービス説明（任意入力）
        const rawDesc =
          (svc.description as string | undefined) ??
          (svc.desc as string | undefined) ??
          "";

        const description = rawDesc ? rawDesc.toString().trim() : "";

        return {
          title,
          label: title, // 旧UI互換
          priceHint, // 保存用・将来用
          price: priceHint || "", // ★ フロント表示用（AiPortfolioServices が読む）
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

  /* ---------- contact ---------- */
  if (toggles.contact !== false) {
    const mail = email as string | undefined;

    // 1) links / socialLinks / sns みたいな配列を広く拾う
    const rawLinksArrays: any[][] = [
      (((payload as any).links as any[]) ?? []) as any[],
      (((payload as any).socialLinks as any[]) ?? []) as any[],
      (((payload as any).sns as any[]) ?? []) as any[],
    ];

    const contactLinks: { label: string; href: string }[] = [];
    const seenHref = new Set<string>();

    const pushLink = (label?: string, href?: string) => {
      if (!label || !href) return;
      const trimmedHref = href.trim();
      if (!trimmedHref) return;
      if (seenHref.has(trimmedHref)) return;
      seenHref.add(trimmedHref);
      contactLinks.push({ label: label.trim(), href: trimmedHref });
    };

    // 1-1) メールアドレスを最初に pill として入れておく
    if (mail) {
      pushLink(mail, `mailto:${mail}`);
    }

    // 1-2) 配列形式の SNS / リンクをすべて拾う
    for (const arr of rawLinksArrays) {
      for (const item of arr) {
        if (!item) continue;
        const label =
          (item.label as string | undefined) ??
          (item.name as string | undefined);
        const href =
          (item.href as string | undefined) ??
          (item.url as string | undefined);
        pushLink(label, href);
      }
    }

    // 1-3) 単体フィールド形式の SNS も拾う
    const snsFieldCandidates: { key: string; label: string }[] = [
      { key: "xUrl", label: "X" },
      { key: "twitterUrl", label: "X" },
      { key: "twitter", label: "X" },
      { key: "instagramUrl", label: "Instagram" },
      { key: "instagram", label: "Instagram" },
      { key: "pixivUrl", label: "pixiv" },
      { key: "pixiv", label: "pixiv" },
      { key: "skebUrl", label: "Skeb" },
      { key: "skeb", label: "Skeb" },
      { key: "boothUrl", label: "BOOTH" },
      { key: "booth", label: "BOOTH" },
      { key: "websiteUrl", label: "Website" },
      { key: "siteUrl", label: "Website" },
      { key: "portfolioUrl", label: "Portfolio" },
    ];

    for (const { key, label } of snsFieldCandidates) {
      const value = (payload as any)[key] as string | undefined;
      if (!value) continue;
      pushLink(label, value);
    }

    sections.push({
      type: "contact",
      headings: ["Contact"],
      paragraphs: ["ご依頼・ご相談はお気軽にご連絡ください。"],
      cta: mail
        ? {
            label: "メールで問い合わせる",
            href: `mailto:${mail}`,
          }
        : contactLinks.length > 0
        ? {
            // メールがない場合は最初のリンクを CTA にする
            label: contactLinks[0].label,
            href: contactLinks[0].href,
          }
        : undefined,
      description: "ご依頼・ご相談はお気軽にご連絡ください。",
      email: mail,
      links: contactLinks.length > 0 ? contactLinks : undefined,
    } as any);
  }

  /* ---------- 最下部 CTA（締め） ---------- */
  if (toggles.cta !== false) {
    sections.push({
      type: "cta",
      headings: ["Let’s work together"],
      paragraphs: [
        "気になった方は、ぜひ一度お気軽にメッセージください。",
      ],
      cta: {
        label: "この内容で相談する",
        href: `mailto:${email}`,
      },
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
function applySectionOrderToContent(
  sections: Content["sections"],
  sectionOrder: string[] | undefined
): Content["sections"] {
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
 * OpenAI に渡す用に sections を圧縮
 * --------------------------------------------------------- */
function buildCompactSectionsForAI(content: Content) {
  const maxSections = 10;
  const maxItemsPerSection = 12;

  const trim = (s: unknown, max: number): string | undefined => {
    if (typeof s !== "string") return undefined;
    return s.length > max ? s.slice(0, max) : s;
  };

  return content.sections.slice(0, maxSections).map((sec: any) => {
    const compact: any = {
      type: sec.type,
    };

    if (sec.headings && sec.headings.length > 0) {
      compact.headings = sec.headings
        .map((h: string) => trim(h, 120))
        .filter(Boolean);
    }

    if (sec.paragraphs && sec.paragraphs.length > 0) {
      compact.paragraphs = sec.paragraphs
        .map((p: string) => trim(p, 400))
        .filter(Boolean);
    }

    if (sec.items && sec.items.length > 0) {
      compact.items = sec.items
        .slice(0, maxItemsPerSection)
        .map((item: any) => ({
          title: trim(item.title, 120),
          description: trim(item.description, 400),
          // 画像URL・価格などは AI には不要なので送らない
        }));
    }

    if (sec.cta) {
      compact.cta = {
        label: trim(sec.cta.label, 80),
      };
    }

    return compact;
  });
}

/* ---------------------------------------------------------
 * OpenAI：軽量プロンプト版 refineContent
 *  - 今回は generate 内から条件付きで呼ぶ
 * --------------------------------------------------------- */
async function refineContentWithOpenAI(
  payload: FormInput,
  design: Design,
  draftContent: Content
): Promise<Content> {
  const openai = getClient();
  const model = process.env.AIPORTFOLIO_MODEL ?? "gpt-4o-mini";

  // AI強度に応じて rewrite の大胆さを調整（overall を採用）
  const strengthOverall =
    ((payload as any).aiStrength?.overall ?? 0) / 100;
  const rewriteLevel = Math.min(1, 0.3 + 0.7 * strengthOverall);

  const worldview =
    (payload as any).designAnswers?.worldviewBase || "minimal";
  const tone = (payload as any).tone || "自然で読みやすい";

  const systemPrompt =
    "あなたはポートフォリオサイトの文章を整える日本語コピーライターです。" +
    "構造（type/items/ctaなど）を変えすぎない範囲で、見出しと文章だけを自然な日本語に整えてください。" +
    "必ず JSON だけ出力し、余分な文章は書かないこと。" +
    '出力形式は { "sections": [...] } です。';

  const compactSections = buildCompactSectionsForAI(draftContent);

  const userPrompt =
    `世界観: ${worldview}\n` +
    `トーン: ${tone}\n` +
    `rewriteLevel(0-1): ${rewriteLevel.toFixed(2)}\n` +
    `名前: ${payload.name ?? ""}\n` +
    `肩書き: ${payload.role ?? ""}\n` +
    `キャッチコピー: ${
      ((payload as any).tagline as string | null | undefined) ?? ""
    }\n` +
    `自己紹介: ${payload.bio ?? ""}\n\n` +
    "以下の sections を上記の世界観に沿って自然に整えてください。\n" +
    "構造（type / items / cta など）はできるだけ変えず、" +
    "headings / paragraphs / items[].title / items[].description を中心にリライトしてください。\n\n" +
    JSON.stringify(compactSections);

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.2 + 0.7 * rewriteLevel, // 0.2〜0.9くらい
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const text = completion.choices[0].message.content ?? "";
  let parsed: unknown;

  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const json = start >= 0 && end > start ? text.slice(start, end + 1) : text;
    parsed = JSON.parse(json);
  } catch (_e) {
    return draftContent;
  }

  const safe = ContentSchema.safeParse(parsed);
  if (!safe.success) return draftContent;
  return safe.data;
}

/* ---------------------------------------------------------
 * メイン：フォーム入力 → デザイン＋内容生成
 * --------------------------------------------------------- */
export async function generatePortfolioFromForm(
  rawPayload: unknown
): Promise<{ design: Design; content: Content }> {
  const t0 = Date.now();
  let tp = t0;
  console.log("⏱ [GEN0] start generate");

  // 1) Zod parse（FormInput はしっかり見る）
  const parsedResult = FormInputSchema.safeParse(rawPayload);
  if (!parsedResult.success) {
    console.error("[GEN1] FormInputSchema error:", parsedResult.error);
    throw new Error("invalid_form_input");
  }
  const payload: FormInput = parsedResult.data;
  console.log(`⏱ [GEN1] after Zod parse: ${Date.now() - tp} ms`);
  tp = Date.now();

  // 2) variant 決定（worldview揺らぎもここで）
  const variant: VariantSpec = deriveVariantFromAnswers(payload);
  console.log(`⏱ [GEN2] after variant: ${Date.now() - tp} ms`);
  tp = Date.now();

  // デバッグログ
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

  // 2.5) LayoutDecision を算出（セクション順など）
  const imagesCount = (payload.images?.length ?? 0) as number;
  const bioLength = (payload.bio ?? "").length;
  const taglineRaw =
    ((payload as any).tagline as string | null | undefined) ?? "";
  const taglineLength = taglineRaw.length;

  const activeTypes = SECTION_ORDER.filter((s) =>
    isSectionEnabled(s.type, payload)
  ).map((s) => s.type);
  const activeSectionsCount = activeTypes.length;

  const layoutStrength = (payload as any).aiStrength?.layout ?? 0;
  const baseLayout =
    (variant.layout as any) === "split" ? "split" : "center";

  const layoutDecision = decideLayout({
    baseLayout,
    layoutStrength,
    imagesCount,
    bioLength,
    taglineLength,
    activeSectionsCount,
    hasFeatured: false, // ★ 将来 featured 作品があれば true にする。
    // worldview や overall 強度を使いたくなったら、ここに追加で渡す
  } as any);

  console.log("### LAYOUT DECISION", layoutDecision);

  // 3) テーマ色 ＋ worldviewPreset
  const palette = getPalette(variant.worldview);
  const worldviewPreset = getWorldviewPreset(variant.worldview as any);

  // 好きな色：accent ＆ patternColor に使う（背景そのものには使わない）
  const userColorRaw = (payload as any).color as string | undefined;
  const favoriteColors = (payload as any).favoriteColors as
    | { hex: string; weight?: number }[]
    | undefined;
  const favoriteHex = favoriteColors?.[0]?.hex;

  const userColor = (userColorRaw || favoriteHex || "").trim();
  const accent = userColor || palette.accent;
  const patternColor = userColor || palette.primary;

  // ユーザーがフォーム詳細で選んだベース柄（なければ undefined）
  const userPatternBase =
    (payload as any).designAnswers?.patternBase || undefined;
  const hasUserPattern = !!userPatternBase;

  // ★ 最終的に使うメイン柄
  const primaryPattern: string =
    (userPatternBase as string | undefined) ||
    ((variant.pattern as unknown) as string | undefined) ||
    ((worldviewPreset as any).patternBase as string | undefined) ||
    "none";

  // ★ 背景レイヤー
  const presetPatternLayers: string[] =
    ((worldviewPreset as any).patternLayers as string[] | undefined) ?? [];
  const patternLayers: string[] = hasUserPattern
    ? primaryPattern === "none"
      ? []
      : [primaryPattern]
    : presetPatternLayers.length > 0
    ? presetPatternLayers
    : primaryPattern === "none"
    ? []
    : [primaryPattern];

  const presetTextureLayers: string[] =
    ((worldviewPreset as any).textureLayers as string[] | undefined) ?? [];

  const bgStyle = (worldviewPreset as any).bgStyle;

  // Design を組み立て（Zod で一度通すが、失敗しても致命傷にしない）
  const designInput = {
    theme: {
      colorPrimary: palette.primary,
      colorAccent: accent,
      colorBG: palette.bg,
      colorText: palette.text,

      backgroundPattern: primaryPattern,
      patternColor,

      languageMode:
        (payload as any).designAnswers?.languageMode ||
        (worldviewPreset as any).languageMode ||
        "ja",
      fontPreset:
        (payload as any).designAnswers?.fontPreset ||
        (worldviewPreset as any).fontPreset ||
        "cleanJa",

      bgGradient: (worldviewPreset as any).bgGradient,
      patternLayers,
      textureLayers: presetTextureLayers,
      bgStyle,
    },
    variantId: (variant as any).id ?? "auto",
    sections: buildDefaultDesignSections(
      payload,
      layoutDecision.sectionOrder
    ),
    // ★ LayoutDecision 側で決めた layoutType をそのまま保存（optional）
    layoutType: (layoutDecision as any).layoutType,
  };

  const designParsed = DesignSchema.safeParse(designInput);
  if (!designParsed.success) {
    console.error("[GEN3] DesignSchema error:", designParsed.error);
  }
  const design: Design & { variantSpec: VariantSpec; layoutDecision?: any } = {
    ...(designParsed.success ? designParsed.data : (designInput as Design)),
    variantSpec: variant,
    layoutDecision, // ★ 追加で持たせておく（UIで参照したくなったとき用）
  };

  console.log(`⏱ [GEN3] design built: ${Date.now() - tp} ms`);
  tp = Date.now();

  // 4) draft content（ここは Zod 失敗してもそのまま通す）
  const rawSections = buildDefaultContentSections(payload, variant);
  const orderedSections = applySectionOrderToContent(
    rawSections as any,
    layoutDecision.sectionOrder
  );

  const contentInput: Content = { sections: orderedSections as any };

  const contentParsed = ContentSchema.safeParse(contentInput);
  if (!contentParsed.success) {
    console.error("[GEN4] ContentSchema error:", contentParsed.error);
  }
  const draftContent: Content = contentParsed.success
    ? contentParsed.data
    : contentInput;

  // デバッグ
  console.log(
    "[DEBUG] content.sections",
    JSON.stringify(draftContent.sections, null, 2)
  );

  console.log(`⏱ [GEN4] draft content built: ${Date.now() - tp} ms`);
  tp = Date.now();

    // 5) OpenAI で文章だけ軽く整える（条件付き）
  const overallStrength = calcOverallStrength(
    (payload as any).aiStrength
  );
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const shouldUseAI = overallStrength >= 20 && hasApiKey;

  let finalContent = draftContent;

  console.log("[GEN5] overallStrength:", overallStrength, "hasApiKey:", hasApiKey, "shouldUseAI:", shouldUseAI);

  if (shouldUseAI) {
    console.log(
      `⏱ [GEN5] refineContent start (overall=${overallStrength})`
    );
    try {
      finalContent = await refineContentWithOpenAI(
        payload,
        design,
        draftContent
      );
      console.log(
        `⏱ [GEN5] refineContent finished in ${Date.now() - tp} ms`
      );
    } catch (e) {
      console.error("[GEN5] refineContent error:", e);
    }
  } else {
    console.log(
      `⏱ [GEN5] skip refineContent (overall=${overallStrength}, hasApiKey=${hasApiKey})`
    );
  }

  console.log(`⏱ [GEN6] total: ${Date.now() - t0} ms`);

  return { design, content: finalContent };
}
