// src/lib/card/card.generate.ts
// Preset-based design generation (no OpenAI)

import type { CardFormInput, CardDesign, CardContent } from "./card.schema";
import {
  getWorldviewPreset,
  WORLDVIEW_KEYS,
} from "@/lib/aura/aura.worldviewPresets";
import { blendColor, saturateColor, desaturateColor } from "./card.colorUtils";

/**
 * Determine AI strength level from numeric value
 */
function getAiStrengthLevel(v: number): "low" | "mid" | "high" {
  if (v <= 29) return "low";
  if (v >= 71) return "high";
  return "mid";
}

/**
 * Generate card design and content from form input.
 * Uses worldview presets - no AI/OpenAI calls.
 */
export function generateCardFromForm(input: CardFormInput): {
  design: CardDesign;
  content: CardContent;
} {
  const worldview = WORLDVIEW_KEYS.includes(input.worldview as any)
    ? input.worldview
    : "minimal";

  const preset = getWorldviewPreset(worldview);
  const level = getAiStrengthLevel(input.aiStrength);

  const design: CardDesign = {
    worldview,
    colorPrimary: preset.colorPrimary,
    colorAccent: preset.colorAccent,
    colorBG: preset.colorBG,
    colorText: preset.colorText,
    bgGradient: preset.bgGradient,
    fontPreset: preset.fontPreset,
    animation: true,
    aiStrengthLevel: level,
  };

  // Apply AI strength variation based on level
  if (level === "low") {
    // Desaturate colors, remove gradient
    design.colorPrimary = desaturateColor(preset.colorPrimary, 0.4);
    design.colorAccent = desaturateColor(preset.colorAccent, 0.4);
    design.bgGradient = "none";
  } else if (level === "high") {
    // Saturate colors, enhance gradient
    design.colorPrimary = saturateColor(preset.colorPrimary, 0.3);
    design.colorAccent = saturateColor(preset.colorAccent, 0.3);
    const shift = (input.aiStrength - 70) / 30;
    design.colorAccent = blendColor(
      design.colorAccent,
      design.colorPrimary,
      shift * 0.3,
    );
    if (preset.bgGradient && preset.bgGradient !== "none") {
      // Keep and enhance existing gradient
      design.bgGradient = preset.bgGradient;
    } else {
      // Add a subtle gradient when preset has none
      design.bgGradient = `linear-gradient(135deg, ${design.colorBG}, ${blendColor(design.colorBG, design.colorPrimary, 0.08)})`;
    }
  }
  // "mid" keeps preset as-is

  const content: CardContent = {
    profile: {
      name: input.name,
      title: input.title,
      tagline: input.tagline || undefined,
      email: input.email,
      avatarUrl: input.avatarUrl || undefined,
      sns: input.sns?.filter((s) => s.url) || undefined,
    },
    works: input.works
      ?.filter((w) => w.imageUrl)
      .map((w) => ({
        imageUrl: w.imageUrl,
        title: w.title || undefined,
        focusX: w.focusX,
        focusY: w.focusY,
      })),
    branding: false,
  };

  return { design, content };
}
