// src/lib/aiPortfolio/aiPortfolio.worldviewRules.ts
import type { CSSProperties } from "react";
import type { LayoutPref } from "./aiPortfolio.layout";
import type { SurfaceStyle, WorldviewBase } from "./aiPortfolio.worldviewPresets";

/**
 * WorldviewRules
 * - 「仕様書の粒度」を落とさずに、実装へ落とし込める形で構造化したルールセット。
 * - ここは「世界観そのものの定義」。
 * - generate/renderer はこのルールを参照して、tokens・背景戦略・禁止事項・推奨を適用する。
 */

export type Density = "airy" | "normal" | "dense";
export type BackgroundStrategy = "solid" | "gradient" | "pattern" | "layered";
export type CardExpression = "flat" | "outlined" | "elevated" | "glass" | "neon";
export type AccentPolicy = "none" | "minimal" | "normal" | "strong";

/** UI tokens（角丸・線・影など） */
export type UiTokens = {
  radius: {
    section: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
    card: "sm" | "md" | "lg" | "xl" | "2xl";
    pill: "full" | "lg" | "xl";
  };
  border: {
    width: 0 | 1 | 2;
    style: "none" | "solid";
    color: string; // rgba/hex
  };
  shadow: {
    enabled: boolean;
    value: string; // box-shadow raw
  };
  surface: SurfaceStyle; // simple/card/glass/paper/neon/dark
};

/** 背景・柄・質感（レイヤーも含む） */
export type BackgroundRules = {
  strategy: BackgroundStrategy;

  /** 背景切替：セクション毎に色を変えるか（仕様で禁止の worldview がある） */
  allowSectionBackgroundSwitch: boolean;

  /** ベース背景（solid/gradient） */
  base: {
    backgroundColor: string;
    bgGradient?: string;
  };

  /** 柄/テクスチャ（patternRegistry に存在する id を使う前提） */
  pattern: {
    allowed: boolean;
    basePatternId: string; // "none" or patternId
    patternColor: string; // pattern overlay color
    patternLayers?: string[]; // multiple patterns
    textureLayers?: string[]; // texture-* layer
  };

  /** renderer に渡す最終CSS（bgStyle） */
  bgStyle?: CSSProperties;
};

/** タイポ/トーン */
export type ToneRules = {
  impression: string[]; // 印象キーワード
  copyTone: "quiet" | "neutral" | "friendly" | "bold";
  headingStyle: "plain" | "structured" | "decorative";
  linkStyle: "subtle" | "normal" | "accent";
};

/** レイアウト・密度 */
export type LayoutRules = {
  layoutPref: LayoutPref; // center/split
  density: Density;
  allowLongScroll: boolean; // 余白が大きくスクロール量が増えるのを許容するか
};

/** セクション囲みカード（あなたの仕様：0-20は「セクション囲みカードなし」） */
export type SectionContainerRules = {
  /** セクション全体を囲うカード（works/servicesのカードとは別概念） */
  sectionCardEnabled: boolean;

  /** セクションカードの表現 */
  expression: CardExpression;

  /** 禁止事項（実装で assert できるよう配列化） */
  prohibited: string[];
};

/** カラー方針 */
export type ColorRules = {
  base: string; // base background
  text: string; // base text
  primary: string;
  accent: string;
  accentPolicy: AccentPolicy;
};

/** 1つの世界観ルール */
export type WorldviewRule = {
  id: WorldviewBase;
  label: string;

  purpose: string[]; // 世界観の目的
  tone: ToneRules;
  colors: ColorRules;

  background: BackgroundRules;
  layout: LayoutRules;

  ui: UiTokens;
  sectionContainer: SectionContainerRules;

  /** 作品カード/サービスカード等の「内部カード」方針（セクション囲みとは別） */
  innerCards: {
    expression: CardExpression;
    borderlessPreferred: boolean;
    shadowPreferred: boolean;
    note: string[];
  };

  /** 仕様に対する禁止事項（最上位でまとめ） */
  prohibited: string[];

  /** 実装メモ（設計意図/注意点） */
  implementationNotes: string[];
};

/* =========================================================
 * 10 Worldviews Rules（完全版）
 * ========================================================= */

export const WORLDVIEW_RULES: Record<WorldviewBase, WorldviewRule> = {
  /* -------------------------------------------------------
   * 1) Minimal
   * ------------------------------------------------------- */
  minimal: {
    id: "minimal",
    label: "Minimal",

    purpose: [
      "作品そのものを最優先で見せる",
      "UIや装飾の存在を極力感じさせない",
      "余白＝上質という印象を与える",
    ],

    tone: {
      impression: ["静か", "洗練", "無駄がない", "感情を押し付けない"],
      copyTone: "quiet",
      headingStyle: "plain",
      linkStyle: "subtle",
    },

    colors: {
      base: "#FFFFFF",
      text: "#111827",
      primary: "#111827",
      accent: "#6B7280",
      accentPolicy: "none",
    },

    background: {
      strategy: "solid",
      allowSectionBackgroundSwitch: false,
      base: { backgroundColor: "#FFFFFF" },
      pattern: {
        allowed: false,
        basePatternId: "none",
        patternColor: "rgba(0,0,0,0)",
        patternLayers: [],
        textureLayers: [],
      },
      bgStyle: {
        backgroundColor: "#FFFFFF",
        backgroundImage: "none",
      },
    },

    layout: {
      layoutPref: "center",
      density: "airy",
      allowLongScroll: true,
    },

    ui: {
      radius: { section: "none", card: "md", pill: "full" },
      border: { width: 0, style: "none", color: "rgba(0,0,0,0)" },
      shadow: { enabled: false, value: "none" },
      surface: "simple",
    },

    sectionContainer: {
      sectionCardEnabled: false,
      expression: "flat",
      prohibited: ["背景切替", "強いアクセントカラー", "装飾的な見出し", "柄/質感/グラデーション"],
    },

    innerCards: {
      expression: "flat",
      borderlessPreferred: true,
      shadowPreferred: false,
      note: [
        "作品カードは『並べる』感覚。囲いの存在感を抑える",
        "枠線なし・影なしを基本とし、必要ならごく薄いdivider程度",
      ],
    },

    prohibited: [
      "背景切替（セクション毎の背景色変更）",
      "強いアクセントカラーの常用",
      "装飾的な見出し（過剰なバッジ/罫線/グラデーション）",
      "柄・質感・ノイズ・グラデーションの導入",
    ],

    implementationNotes: [
      "applyVariantStyle 側で border/shadow を最小化（可能なら none）",
      "セクションの見出しも極力プレーン（pill も薄くするか、minimal時は無効化を検討）",
    ],
  },

  /* -------------------------------------------------------
   * 2) Modern
   * ------------------------------------------------------- */
  modern: {
    id: "modern",
    label: "Modern",

    purpose: [
      "シャープで現代的な印象を与える",
      "情報設計（グリッド/階層）で信頼感をつくる",
      "コントラストで作品とUIの境界を明確にする",
    ],

    tone: {
      impression: ["シャープ", "テック寄り", "コントラスト", "整理されている"],
      copyTone: "neutral",
      headingStyle: "structured",
      linkStyle: "accent",
    },

    colors: {
      base: "#020617",
      text: "#E5E7EB",
      primary: "#38BDF8",
      accent: "#6366F1",
      accentPolicy: "normal",
    },

    background: {
      strategy: "layered",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#020617",
        bgGradient: "linear-gradient(145deg, #0f172a 0%, #020617 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "grid-thin",
        patternColor: "rgba(226,232,240,0.18)",
        patternLayers: ["grid-thin"],
        textureLayers: ["texture-noise"],
      },
      bgStyle: {
        backgroundColor: "#020617",
        backgroundImage:
          "linear-gradient(145deg, #0f172a 0%, #020617 100%)," +
          "linear-gradient(rgba(226,232,240,0.10) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(226,232,240,0.10) 1px, transparent 1px)",
        backgroundSize: "auto, 36px 36px, 36px 36px",
        backgroundPosition: "0 0, 0 0, 0 0",
      },
    },

    layout: {
      layoutPref: "split",
      density: "normal",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "lg", card: "lg", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(148,163,184,0.35)" },
      shadow: { enabled: true, value: "0 18px 50px rgba(0,0,0,0.35)" },
      surface: "glass",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "glass",
      prohibited: ["過剰な可愛さ", "レトロ系の装飾"],
    },

    innerCards: {
      expression: "glass",
      borderlessPreferred: false,
      shadowPreferred: true,
      note: [
        "カードはガラス/半透明で層を作る",
        "見出しは構造的（pill + 罫線などはOK）",
      ],
    },

    prohibited: ["パステル主体の配色", "手描き風の質感過多"],
    implementationNotes: [
      "split前提：services/works は2カラムにして『編集された誌面感』を出す",
      "bgStyle は renderer 側で multiple backgrounds を使っても良い",
    ],
  },

  /* -------------------------------------------------------
   * 3) Business
   * ------------------------------------------------------- */
  business: {
    id: "business",
    label: "Business",

    purpose: [
      "信頼感・読みやすさを最優先",
      "情報が整っている印象（業務品質）を出す",
      "営業に必要な情報（提供価値/実績/連絡）を迷わせず提示",
    ],

    tone: {
      impression: ["信頼", "落ち着き", "読みやすい", "端的"],
      copyTone: "neutral",
      headingStyle: "structured",
      linkStyle: "accent",
    },

    colors: {
      base: "#EFF6FF",
      text: "#111827",
      primary: "#2563EB",
      accent: "#0F172A",
      accentPolicy: "minimal",
    },

    background: {
      strategy: "gradient",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#EFF6FF",
        bgGradient: "linear-gradient(145deg, #e2e8f0 0%, #f8fafc 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "none",
        patternColor: "rgba(37,99,235,0.08)",
        patternLayers: [],
        textureLayers: ["texture-paper"],
      },
      bgStyle: {
        backgroundColor: "#EFF6FF",
        backgroundImage: "linear-gradient(145deg, #e2e8f0 0%, #f8fafc 100%)",
      },
    },

    layout: {
      layoutPref: "center",
      density: "normal",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "lg", card: "lg", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(148,163,184,0.55)" },
      shadow: { enabled: true, value: "0 14px 32px rgba(15,23,42,0.12)" },
      surface: "card",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "outlined",
      prohibited: ["ネオン過多", "装飾過剰な見出し", "派手な柄の常用"],
    },

    innerCards: {
      expression: "outlined",
      borderlessPreferred: false,
      shadowPreferred: true,
      note: [
        "カードは読みやすい白面＋薄い線＋適度な影",
        "価格/実績などの『数字情報』が強く見える設計",
      ],
    },

    prohibited: ["過剰なグラデーション", "可読性を犠牲にする装飾"],
    implementationNotes: [
      "Business tokens（色・角丸・線・影）は preset 化して横展開する価値が高い",
      "Services セクションは『タイトル/価格中央＋説明左』のB案は相性が良い（営業読みやすい）",
    ],
  },

  /* -------------------------------------------------------
   * 4) Cute
   * ------------------------------------------------------- */
  cute: {
    id: "cute",
    label: "Cute",

    purpose: [
      "親しみやすさで第一印象を取りに行く",
      "丸みとやわらかさで作者の人柄を伝える",
      "可愛いが“子供っぽい”にならないラインで整える",
    ],

    tone: {
      impression: ["やわらかい", "親しみ", "明るい", "安心感"],
      copyTone: "friendly",
      headingStyle: "decorative",
      linkStyle: "accent",
    },

    colors: {
      base: "#FEF2F2",
      text: "#7F1D1D",
      primary: "#FB7185",
      accent: "#FDBA74",
      accentPolicy: "normal",
    },

    background: {
      strategy: "pattern",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#FEF2F2",
        bgGradient: "linear-gradient(145deg, #fff1f2 0%, #ffe4e6 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "dot-soft",
        patternColor: "rgba(251,113,133,0.18)",
        patternLayers: ["dot-soft"],
        textureLayers: [],
      },
      bgStyle: {
        backgroundColor: "#FEF2F2",
        backgroundImage:
          "radial-gradient(rgba(251,113,133,0.22) 2px, transparent 2px)," +
          "radial-gradient(rgba(251,113,133,0.18) 2px, transparent 2px)",
        backgroundSize: "34px 34px",
        backgroundPosition: "0 0, 17px 17px",
      },
    },

    layout: {
      layoutPref: "center",
      density: "normal",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "xl", card: "xl", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(251,113,133,0.30)" },
      shadow: { enabled: true, value: "0 18px 40px rgba(251,113,133,0.12)" },
      surface: "paper",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "outlined",
      prohibited: ["強すぎるコントラスト", "無機質すぎる表現"],
    },

    innerCards: {
      expression: "elevated",
      borderlessPreferred: false,
      shadowPreferred: true,
      note: ["角丸は大きめで統一", "ピル/バッジは使用OKだが文字は読みやすく"],
    },

    prohibited: ["ネオン", "ダーク過多"],
    implementationNotes: [
      "フォントは丸ゴシック系を推奨（cuteRound 等）",
      "UIの主張で作品を潰さないよう、彩度は抑制する",
    ],
  },

  /* -------------------------------------------------------
   * 5) Pop
   * ------------------------------------------------------- */
  pop: {
    id: "pop",
    label: "Pop",

    purpose: [
      "元気さ・楽しさで目を止める",
      "リズムのある配色・柄でテンションを作る",
      "作品とUIが喧嘩しないよう、情報整理は崩さない",
    ],

    tone: {
      impression: ["元気", "リズム", "明るい", "勢い"],
      copyTone: "bold",
      headingStyle: "decorative",
      linkStyle: "accent",
    },

    colors: {
      base: "#FEF3C7",
      text: "#78350F",
      primary: "#F97316",
      accent: "#EC4899",
      accentPolicy: "strong",
    },

    background: {
      strategy: "pattern",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#FFFBEB",
        bgGradient: "linear-gradient(145deg, #fff7ed 0%, #ffedd5 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "stripe-diagonal",
        patternColor: "rgba(249,115,22,0.16)",
        patternLayers: ["stripe-diagonal"],
        textureLayers: [],
      },
      bgStyle: {
        backgroundColor: "#FFFBEB",
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(253,230,138,0.75) 0, rgba(253,230,138,0.75) 2px, transparent 0, transparent 18px)",
        backgroundSize: "22px 22px",
      },
    },

    layout: {
      layoutPref: "center",
      density: "dense",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "lg", card: "lg", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(249,115,22,0.32)" },
      shadow: { enabled: true, value: "0 18px 50px rgba(120,53,15,0.18)" },
      surface: "card",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "elevated",
      prohibited: ["余白過多", "淡すぎる配色"],
    },

    innerCards: {
      expression: "elevated",
      borderlessPreferred: false,
      shadowPreferred: true,
      note: ["masonry と相性が良い", "文字は読みやすく、派手さは“背景”で出す"],
    },

    prohibited: ["暗すぎるトーン", "情報量過多で破綻するレイアウト"],
    implementationNotes: ["アクセントカラーの使い所を限定（CTA廃止でもリンク/見出しで十分派手）"],
  },

  /* -------------------------------------------------------
   * 6) Natural
   * ------------------------------------------------------- */
  natural: {
    id: "natural",
    label: "Natural",

    purpose: [
      "落ち着き・安心・手触り感を出す",
      "作品の温度感を邪魔しない柔らかさ",
      "紙や繊維のような“弱い質感”で世界観を補強",
    ],

    tone: {
      impression: ["自然", "柔らかい", "安心", "穏やか"],
      copyTone: "neutral",
      headingStyle: "structured",
      linkStyle: "normal",
    },

    colors: {
      base: "#F0FDF4",
      text: "#064E3B",
      primary: "#22C55E",
      accent: "#15803D",
      accentPolicy: "minimal",
    },

    background: {
      strategy: "layered",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#F0FDF4",
        bgGradient: "linear-gradient(145deg, #ecfdf5 0%, #dcfce7 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "fiber-soft",
        patternColor: "rgba(34,197,94,0.12)",
        patternLayers: ["fiber-soft"],
        textureLayers: ["texture-paper"],
      },
      bgStyle: {
        backgroundColor: "#F0FDF4",
        backgroundImage:
          "linear-gradient(145deg, #ecfdf5 0%, #dcfce7 100%)," +
          "repeating-linear-gradient(-45deg, rgba(220,252,231,0.85), rgba(220,252,231,0.85) 5px, transparent 5px, transparent 24px)",
        backgroundSize: "auto, auto",
      },
    },

    layout: {
      layoutPref: "center",
      density: "airy",
      allowLongScroll: true,
    },

    ui: {
      radius: { section: "lg", card: "lg", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(21,128,61,0.22)" },
      shadow: { enabled: true, value: "0 16px 42px rgba(6,78,59,0.10)" },
      surface: "paper",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "outlined",
      prohibited: ["ネオン", "強コントラスト"],
    },

    innerCards: {
      expression: "outlined",
      borderlessPreferred: false,
      shadowPreferred: false,
      note: ["影は弱め。紙の面で整理する", "写真作品にも相性が良い"],
    },

    prohibited: ["派手すぎるアクセント"],
    implementationNotes: ["紙/繊維系 texture を軽く混ぜる程度に留める"],
  },

  /* -------------------------------------------------------
   * 7) Luxury
   * ------------------------------------------------------- */
  luxury: {
    id: "luxury",
    label: "Luxury",

    purpose: [
      "高級感・余裕・重厚さを作る",
      "黒×金系のコントラストで格を出す",
      "装飾は“素材感”で出し、過剰演出は避ける",
    ],

    tone: {
      impression: ["重厚", "高級", "静かな自信", "大人っぽい"],
      copyTone: "quiet",
      headingStyle: "structured",
      linkStyle: "accent",
    },

    colors: {
      base: "#1C1917",
      text: "#FAFAF5",
      primary: "#EAB308",
      accent: "#F97316",
      accentPolicy: "normal",
    },

    background: {
      strategy: "layered",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#1C1917",
        bgGradient: "linear-gradient(145deg, #0c0a09 0%, #1c1917 60%, #292524 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "diamond-soft",
        patternColor: "rgba(234,179,8,0.10)",
        patternLayers: ["diamond-soft"],
        textureLayers: ["texture-noise"],
      },
      bgStyle: {
        backgroundColor: "#1C1917",
        backgroundImage:
          "linear-gradient(145deg, #0c0a09 0%, #1c1917 60%, #292524 100%)," +
          "radial-gradient(rgba(234,179,8,0.10) 1px, transparent 1px)",
        backgroundSize: "auto, 22px 22px",
      },
    },

    layout: {
      layoutPref: "center",
      density: "normal",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "lg", card: "lg", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(234,179,8,0.28)" },
      shadow: { enabled: true, value: "0 26px 70px rgba(0,0,0,0.55)" },
      surface: "dark",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "elevated",
      prohibited: ["可愛すぎる丸み", "原色の多用"],
    },

    innerCards: {
      expression: "elevated",
      borderlessPreferred: false,
      shadowPreferred: true,
      note: ["文字の余白で高級感を出す", "金アクセントは線/点で使う"],
    },

    prohibited: ["ポップ系の柄", "ネオン"],
    implementationNotes: ["luxury は“暗さ”でなく“重さ”を設計する。黒は潰さず階調を残す"],
  },

  /* -------------------------------------------------------
   * 8) Retro
   * ------------------------------------------------------- */
  retro: {
    id: "retro",
    label: "Retro",

    purpose: [
      "どこか懐かしい紙面/印刷物のムードを作る",
      "黄味がかった背景で温度感を出す",
      "ドット/版ズレ感は“やり過ぎない”",
    ],

    tone: {
      impression: ["懐かしい", "温かい", "紙っぽい", "遊び心"],
      copyTone: "neutral",
      headingStyle: "decorative",
      linkStyle: "normal",
    },

    colors: {
      base: "#FFFBEB",
      text: "#422006",
      primary: "#F97316",
      accent: "#10B981",
      accentPolicy: "normal",
    },

    background: {
      strategy: "pattern",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#FFFBEB",
        bgGradient: "linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "dot-retro",
        patternColor: "rgba(217,119,6,0.18)",
        patternLayers: ["dot-retro"],
        textureLayers: ["texture-paper"],
      },
      bgStyle: {
        backgroundColor: "#FFFBEB",
        backgroundImage: "radial-gradient(rgba(217,119,6,0.22) 2px, transparent 2px)",
        backgroundSize: "16px 16px",
      },
    },

    layout: {
      layoutPref: "center",
      density: "normal",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "md", card: "md", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(66,32,6,0.20)" },
      shadow: { enabled: true, value: "0 18px 44px rgba(66,32,6,0.16)" },
      surface: "paper",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "outlined",
      prohibited: ["クリーンすぎる無機質", "ネオン"],
    },

    innerCards: {
      expression: "outlined",
      borderlessPreferred: false,
      shadowPreferred: false,
      note: ["紙の質感で十分。影は薄く", "文字は読みやすさ優先で“レトロフォント過多”は避ける"],
    },

    prohibited: ["サイバー系の演出"],
    implementationNotes: ["retroPixel 等は見出しだけ、本文は可読性の高いフォントに逃がすのも手"],
  },

  /* -------------------------------------------------------
   * 9) Cyber
   * ------------------------------------------------------- */
  cyber: {
    id: "cyber",
    label: "Cyber",

    purpose: [
      "ネオン×グリッドで“未来感”を作る",
      "暗背景に発光を置き、視線誘導を作る",
      "作品が負けないよう、発光は線/縁/点に限定",
    ],

    tone: {
      impression: ["未来", "発光", "緊張感", "テック"],
      copyTone: "bold",
      headingStyle: "decorative",
      linkStyle: "accent",
    },

    colors: {
      base: "#020617",
      text: "#E5E7EB",
      primary: "#22D3EE",
      accent: "#6366F1",
      accentPolicy: "strong",
    },

    background: {
      strategy: "layered",
      allowSectionBackgroundSwitch: true,
      base: {
        backgroundColor: "#020617",
        bgGradient: "linear-gradient(145deg, #020617 0%, #0f172a 50%, #1e293b 100%)",
      },
      pattern: {
        allowed: true,
        basePatternId: "grid-cyber",
        patternColor: "rgba(34,211,238,0.12)",
        patternLayers: ["grid-cyber"],
        textureLayers: ["texture-noise"],
      },
      bgStyle: {
        backgroundColor: "#020617",
        backgroundImage:
          "linear-gradient(145deg, #020617 0%, #0f172a 50%, #1e293b 100%)," +
          "linear-gradient(rgba(34,211,238,0.12) 1px, transparent 1px)," +
          "linear-gradient(90deg, rgba(34,211,238,0.12) 1px, transparent 1px)",
        backgroundSize: "auto, 40px 40px, 40px 40px",
      },
    },

    layout: {
      layoutPref: "split",
      density: "dense",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "lg", card: "lg", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(34,211,238,0.35)" },
      shadow: { enabled: true, value: "0 0 0 1px rgba(34,211,238,0.18), 0 22px 70px rgba(0,0,0,0.55)" },
      surface: "neon",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "neon",
      prohibited: ["パステル", "紙っぽい温かさ"],
    },

    innerCards: {
      expression: "neon",
      borderlessPreferred: false,
      shadowPreferred: true,
      note: ["neon は“面”より“縁”で出す", "テキストは読みやすさ優先で発光しすぎない"],
    },

    prohibited: ["ナチュラル系の質感過多"],
    implementationNotes: ["applyVariantStyle の neon で border/shadow を発光寄りに寄せる"],
  },

  /* -------------------------------------------------------
   * 10) Dark
   * ------------------------------------------------------- */
  dark: {
    id: "dark",
    label: "Dark",

    purpose: [
      "落ち着きと集中を作る（作品の没入）",
      "暗背景で作品を浮かせる",
      "演出は控えめ。サイバーほど発光させない",
    ],

    tone: {
      impression: ["落ち着き", "集中", "没入", "静けさ"],
      copyTone: "quiet",
      headingStyle: "structured",
      linkStyle: "normal",
    },

    colors: {
      base: "#020617",
      text: "#E5E7EB",
      primary: "#F97316",
      accent: "#E5E7EB",
      accentPolicy: "minimal",
    },

    background: {
      strategy: "pattern",
      allowSectionBackgroundSwitch: true,
      base: { backgroundColor: "#020617", bgGradient: "linear-gradient(145deg, #020617 0%, #020617 100%)" },
      pattern: {
        allowed: true,
        basePatternId: "grid-subtle",
        patternColor: "rgba(51,65,85,0.32)",
        patternLayers: ["grid-subtle"],
        textureLayers: ["texture-noise"],
      },
      bgStyle: {
        backgroundColor: "#020617",
        backgroundImage:
          "radial-gradient(rgba(51,65,85,0.35) 1.5px, transparent 1.5px)",
        backgroundSize: "20px 20px",
      },
    },

    layout: {
      layoutPref: "split",
      density: "normal",
      allowLongScroll: false,
    },

    ui: {
      radius: { section: "lg", card: "lg", pill: "full" },
      border: { width: 1, style: "solid", color: "rgba(148,163,184,0.25)" },
      shadow: { enabled: true, value: "0 24px 70px rgba(0,0,0,0.60)" },
      surface: "dark",
    },

    sectionContainer: {
      sectionCardEnabled: true,
      expression: "elevated",
      prohibited: ["ネオン過多（cyberとの差別化）", "過度な柄"],
    },

    innerCards: {
      expression: "elevated",
      borderlessPreferred: false,
      shadowPreferred: true,
      note: ["dark は“静か”が第一。装飾を増やしすぎない"],
    },

    prohibited: ["派手な演出", "高彩度の多用"],
    implementationNotes: ["dark は cyber と差別化：発光は使わず、影と階調で見せる"],
  },
};

export function getWorldviewRule(id: WorldviewBase | string): WorldviewRule {
  const key = id as WorldviewBase;
  if (key && (WORLDVIEW_RULES as any)[key]) return WORLDVIEW_RULES[key];
  return WORLDVIEW_RULES.business;
}
