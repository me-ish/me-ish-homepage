// src/lib/aura/aura.layout.ts

// layoutPref は既存どおり "center" | "split"
export type LayoutPref = "center" | "split";

// 将来の Hero / Works テンプレ用ヒント（今は theme / renderer 側で使う想定）
export type HeroLayoutHint =
  | "centerBasic" // 中央寄せ（デフォルト）
  | "splitHero" // 左右分割ヒーロー
  | "galleryFocus" // Hero から作品を強く見せる構図
  | "stacked"; // セクション縦積み・文章重視

export type WorksLayoutHint =
  | "simpleGrid" // ふつうのグリッド
  | "masonry" // 敷き詰めマソナリー
  | "singleHero" // 1枚ヒーロー型
  | "rows"; // 横並びの列レイアウト

// showcaseStyle は既存どおり
export type ShowcaseStyle = "gallery" | "masonry" | "card" | "textRich";

// セクション種別（Design / Content の type と揃える）
export type SectionType =
  | "hero"
  | "about"
  | "works"
  | "services"
  | "skills"
  | "contact"
  | "cta";

// ★ 追加：レイアウトの「系統」タグ
export type LayoutType = "L1" | "L2" | "L3" | "L4";

export type LayoutDecision = {
  // 実際に theme.layoutPref に入る値（center/split）
  layoutPref: LayoutPref;
  // 将来の Hero / Works テンプレ用ヒント
  heroLayout: HeroLayoutHint;
  worksLayout: WorksLayoutHint;
  // AI が推奨するセクションの並び順
  sectionOrder: SectionType[];
  // ★ Layout の系統タグ（center/split × visual/text の4パターン）
  layoutType: LayoutType;
};

export type DecideLayoutInput = {
  baseLayout: LayoutPref;
  layoutStrength: number; // 0–100
  imagesCount: number;
  bioLength: number; // 自己紹介の文字数
  taglineLength: number; // キャッチコピーの長さ（Hero 安全判定に使用）
  activeSectionsCount: number;
  hasFeatured: boolean;
};

export type DecideShowcaseInput = {
  baseShowcase: ShowcaseStyle;
  showcaseStrength: number; // 0–100
  imagesCount: number;
  hasFeatured: boolean;
};

/* ---------------------------------------------------------
 * 1. セクション順ロジック
 *   - Hero は基本先頭 / Contact / CTA は末尾寄り
 *   - 画像多め → Works を前へ
 *   - テキスト多め → About をしっかり読ませる順
 * --------------------------------------------------------- */

const DEFAULT_SECTION_ORDER: SectionType[] = [
  "hero",
  "about",
  "works",
  "services",
  "skills",
  "contact",
  "cta",
];

function decideSectionOrder(
  defaultOrder: SectionType[],
  strength: number,
  isVisualHeavy: boolean,
  isTextHeavy: boolean,
): SectionType[] {
  // 強度が低いならデフォルト順を尊重
  if (strength < 30) return defaultOrder;

  const head: SectionType[] = ["hero"];
  const tail: SectionType[] = ["contact", "cta"];

  const middle = defaultOrder.filter(
    (t) => !head.includes(t) && !tail.includes(t),
  );

  // ビジュアル重視（画像多め）→ Works を前倒し
  if (isVisualHeavy) {
    const idx = middle.indexOf("works");
    if (idx > -1) {
      middle.splice(idx, 1);
      middle.unshift("works"); // hero → works → about ...
    }
  }

  // テキスト重視（long bio）→ About 先頭はそのままだが、
  // Skills / Services を前寄せするなどで「人となり」を手前に集める
  if (isTextHeavy && strength > 60) {
    const skillsIdx = middle.indexOf("skills");
    if (skillsIdx > 0) {
      middle.splice(skillsIdx, 1);
      middle.splice(1, 0, "skills");
    }
  }

  return [...head, ...middle, ...tail];
}

/* ---------------------------------------------------------
 * 2. レイアウト決定（4-2. layoutStrength の仕様準拠）
 *
 * - 0〜20 : layoutPref を忠実に採用
 * - 20〜70: 条件から 2〜3 候補に絞って乱択
 * - 70〜100: galleryFocus / stacked / splitHero 系を解禁
 *
 * ★ layoutType 判定ルール
 *   - center & 画像少なめ        → L1（センター×バランス）
 *   - center & 画像多め          → L2（センター×ビジュアル重視）
 *   - split  & 画像少なめ        → L3（スプリット×ストーリー重視）
 *   - split  & 画像多め          → L4（スプリット×ビジュアル重視）
 * --------------------------------------------------------- */
export function decideLayout(input: DecideLayoutInput): LayoutDecision {
  const {
    baseLayout,
    layoutStrength,
    imagesCount,
    bioLength,
    taglineLength,
    activeSectionsCount,
    hasFeatured,
  } = input;

  // デフォルトは「安全側」
  let heroLayout: HeroLayoutHint = "centerBasic";
  let worksLayout: WorksLayoutHint =
    imagesCount <= 1 ? "singleHero" : "simpleGrid";
  let layoutPref: LayoutPref = baseLayout;

  // 共通の文脈フラグ
  const longBio = bioLength >= 280; // 自己紹介長め
  const manySections = activeSectionsCount >= 4;
  const manyImages = imagesCount >= 4;
  const fewImages = imagesCount <= 1;
  const shortTagline = taglineLength < 20;

  const defaultOrder = DEFAULT_SECTION_ORDER;

  // 1枚テンプレ（仕様：images.length <= 1 は special 扱い）
  if (fewImages) {
    // 1枚のときは基本「ヒーロー＋1枚ヒーロー作品」構成
    heroLayout = "centerBasic";
    worksLayout = "singleHero";

    if (layoutStrength >= 70 && !shortTagline) {
      // 強めのときは splitHero も解禁
      layoutPref = baseLayout === "center" ? "split" : baseLayout;
      heroLayout = layoutPref === "split" ? "splitHero" : "centerBasic";
    }

    const sectionOrder = decideSectionOrder(
      defaultOrder,
      layoutStrength,
      false,
      longBio,
    );

    const layoutType: LayoutType =
      layoutPref === "center" ? "L1" : "L3";

    return { layoutPref, heroLayout, worksLayout, sectionOrder, layoutType };
  }

  // 0〜20: base を忠実に使う
  if (layoutStrength <= 20) {
    heroLayout = baseLayout === "center" ? "centerBasic" : "splitHero";
    worksLayout = manyImages ? "simpleGrid" : "rows";

    const sectionOrder = decideSectionOrder(
      defaultOrder,
      layoutStrength,
      manyImages || hasFeatured,
      longBio,
    );

    // Safety: shortTagline なのに SplitHero は避ける
    if (heroLayout === "splitHero" && shortTagline) {
      heroLayout = "centerBasic";
    }

    const isVisualHeavy = manyImages || hasFeatured;
    const layoutType: LayoutType =
      baseLayout === "center"
        ? isVisualHeavy
          ? "L2"
          : "L1"
        : isVisualHeavy
        ? "L4"
        : "L3";

    return {
      layoutPref: baseLayout,
      heroLayout,
      worksLayout,
      sectionOrder,
      layoutType,
    };
  }

  // 20〜70: 条件から 2〜3 候補に絞って乱択
  const heroCandidates: HeroLayoutHint[] = [];
  const worksCandidates: WorksLayoutHint[] = [];

  // ベース候補は必ず含める
  heroCandidates.push(baseLayout === "center" ? "centerBasic" : "splitHero");
  worksCandidates.push(manyImages ? "simpleGrid" : "rows");

  // 画像が多い or featured あり → galleryFocus / masonry を候補に追加
  if (manyImages || hasFeatured) {
    heroCandidates.push("galleryFocus");
    worksCandidates.push("masonry");
  }

  // テキスト多め & セクション多め → stacked 候補
  if (longBio || manySections) {
    heroCandidates.push("stacked");
    if (!worksCandidates.includes("rows")) {
      worksCandidates.push("rows");
    }
  }

  const pickWeighted = <T,>(list: T[]): T => {
    if (list.length === 1) return list[0];
    const base = list[0];
    const others = list.slice(1);
    const r = Math.random();
    if (r < 0.6) return base; // base を少し優先
    return others[Math.floor(Math.random() * others.length)];
  };

  heroLayout = pickWeighted(heroCandidates);
  worksLayout = pickWeighted(worksCandidates);

  // Safety Rails
  // Guard 1: タグラインが短すぎるのに SplitHero はスカスカになるので禁止 → centerBasic
  if (heroLayout === "splitHero" && shortTagline) {
    heroLayout = "centerBasic";
  }

  // Guard 2: 画像が少ないのに galleryFocus は禁止 → splitHero or centerBasic
  if (heroLayout === "galleryFocus" && imagesCount < 3) {
    heroLayout = baseLayout === "center" ? "centerBasic" : "splitHero";
  }

  // Guard 3: Masonry は画像4枚未満だとカッコつかない → simpleGrid
  if (worksLayout === "masonry" && imagesCount < 4) {
    worksLayout = "simpleGrid";
  }

  // layoutPref 自体は center/split の 2択のまま
  // 中程度の強度なら、条件に応じて split 採用の確率を少し上げる
  if (layoutStrength >= 40 && (manyImages || longBio || manySections)) {
    const r = Math.random();
    if (r < 0.4) {
      layoutPref = "split";
    }
  }

  // 70〜100: 攻め構図を優先（再度上書き）
  if (layoutStrength >= 70) {
    const aggressiveHero: HeroLayoutHint[] = [
      "galleryFocus",
      "stacked",
      "splitHero",
    ];
    const safeHero: HeroLayoutHint[] = ["centerBasic"];
    const heroPool = aggressiveHero.concat(safeHero);
    heroLayout = heroPool[Math.floor(Math.random() * heroPool.length)];

    const aggressiveWorks: WorksLayoutHint[] = ["masonry", "rows"];
    const safeWorks: WorksLayoutHint[] = ["simpleGrid"];
    const worksPool = aggressiveWorks.concat(safeWorks);
    worksLayout = worksPool[Math.floor(Math.random() * worksPool.length)];

    // Safety を再適用
    if (heroLayout === "splitHero" && shortTagline) {
      heroLayout = "centerBasic";
    }
    if (heroLayout === "galleryFocus" && imagesCount < 3) {
      heroLayout = "splitHero";
    }
    if (worksLayout === "masonry" && imagesCount < 4) {
      worksLayout = "simpleGrid";
    }

    // layoutPref は「splitHero / galleryFocus を選んだら split 寄り」
    if (heroLayout === "splitHero" || heroLayout === "galleryFocus") {
      layoutPref = "split";
    } else {
      // それ以外はベース寄り（ただし 50% でひっくり返す）
      layoutPref =
        Math.random() < 0.5
          ? baseLayout
          : baseLayout === "center"
          ? "split"
          : "center";
    }
  }

  const sectionOrder = decideSectionOrder(
    defaultOrder,
    layoutStrength,
    manyImages || hasFeatured,
    longBio,
  );

  // ★ 最終的な layoutType を判定
  const isVisualHeavy = manyImages || hasFeatured;
  const layoutType: LayoutType =
    layoutPref === "center"
      ? isVisualHeavy
        ? "L2"
        : "L1"
      : isVisualHeavy
      ? "L4"
      : "L3";

  return { layoutPref, heroLayout, worksLayout, sectionOrder, layoutType };
}

/* ---------------------------------------------------------
 * 3. 作品の見せ方（showcaseStyle）決定
 *   （4-3. showcaseStrength の仕様準拠）
 *
 * - 画像枚数に応じて候補セットを決定
 *   0〜1枚: textRich / card
 *   2〜3枚: card / gallery
 *   4枚〜 : gallery / masonry
 *
 * - 0〜20 : 固定
 * - 20〜70: 安全候補から乱択
 * - 70〜100: masonry 高確率 + featured を想定
 * --------------------------------------------------------- */
export function decideShowcase(input: DecideShowcaseInput): ShowcaseStyle {
  const { baseShowcase, showcaseStrength, imagesCount, hasFeatured } = input;

  let candidates: ShowcaseStyle[];

  if (imagesCount <= 1) {
    candidates = ["textRich", "card"];
  } else if (imagesCount <= 3) {
    candidates = ["card", "gallery"];
  } else {
    candidates = ["gallery", "masonry"];
  }

  // ベース候補が candidates に入っていない場合は追加
  if (!candidates.includes(baseShowcase)) {
    candidates.unshift(baseShowcase);
  }

  // 0〜20: 固定（ベース優先）
  if (showcaseStrength <= 20) {
    // Guard: 画像が4枚未満のときは masonry を禁止
    if (candidates[0] === "masonry" && imagesCount < 4) {
      return "gallery";
    }
    return candidates[0];
  }

  // 20〜70: 安全候補から乱択（ベースを少し優先）
  if (showcaseStrength < 70) {
    const r = Math.random();
    let choice: ShowcaseStyle;
    if (r < 0.6) {
      choice = candidates[0];
    } else {
      choice = candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Guard: masonry なのに画像 < 4 は gallery にフォールバック
    if (choice === "masonry" && imagesCount < 4) {
      return "gallery";
    }
    return choice;
  }

  // 70〜100: masonry 高確率 + featured ありならさらに masonry 寄り
  const baseProbMasonry = imagesCount >= 4 ? 0.7 : 0.4;
  const bonus = hasFeatured ? 0.15 : 0;
  const probMasonry = Math.min(0.95, baseProbMasonry + bonus);

  if (candidates.includes("masonry") && imagesCount >= 4) {
    if (Math.random() < probMasonry) {
      return "masonry";
    }
  }

  // masonry が候補に無い場合 or はずれた場合は残りから乱択
  const fallback = candidates[Math.floor(Math.random() * candidates.length)];
  if (fallback === "masonry" && imagesCount < 4) {
    return "gallery";
  }
  return fallback;
}
