/** 量産イラスト専用。通常依頼の掲載オプション・料金とは分けて扱う。 */
export const MASS_PRODUCTION_VARIANTS = ["おばけ", "魔女"] as const;

export const MASS_PRODUCTION_OPTIONS = [
  { id: "mass_costume_color_change", label: "衣装カラーチェンジ", amount: 500 },
  { id: "mass_expression_variation", label: "表情差分", amount: 500 },
] as const;

export const MASS_PRODUCTION_COMMERCIAL_AMOUNT = 1000;
