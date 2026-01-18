// src/components/floatGallery/floatPanels.constants.ts
export const FLOAT_PANELS = {
  // 配置
  radius: 16,
  anglesDeg: [45, 135, 225, 315] as const,

  // 実寸（sharedGeometry の Panel geometry と一致させる）
  width: 18,
  height: 8,
  thickness: 1.0,

  // 衝突のゆるめ（引っかかり防止の余白）
  collisionMargin: 0.12,
} as const;

export type FloatPanelAngleDeg = (typeof FLOAT_PANELS.anglesDeg)[number];
