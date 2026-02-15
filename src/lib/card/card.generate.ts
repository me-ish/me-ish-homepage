// src/lib/card/card.generate.ts
// Preset-based design generation (no OpenAI)

import type { CardFormInput, CardDesign, CardContent } from "./card.schema";
import {
  getWorldviewPreset,
  WORLDVIEW_KEYS,
} from "@/lib/aura/aura.worldviewPresets";

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
  const design: CardDesign = {
    worldview,
    colorPrimary: preset.colorPrimary,
    colorAccent: preset.colorAccent,
    colorBG: preset.colorBG,
    colorText: preset.colorText,
    bgGradient: preset.bgGradient,
    fontPreset: preset.fontPreset,
    animation: true,
  };

  // Apply AI strength variation (subtle color shifts for higher values)
  if (input.aiStrength > 50) {
    const shift = (input.aiStrength - 50) / 100;
    design.colorAccent = blendColor(
      preset.colorAccent,
      preset.colorPrimary,
      shift * 0.3,
    );
  }

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
      })),
    branding: false,
  };

  return { design, content };
}

/**
 * Simple color blending helper
 */
function blendColor(c1: string, c2: string, ratio: number): string {
  const hex = (s: string) => parseInt(s, 16);
  const parse = (c: string) => {
    const h = c.replace("#", "");
    return [hex(h.slice(0, 2)), hex(h.slice(2, 4)), hex(h.slice(4, 6))];
  };

  try {
    const [r1, g1, b1] = parse(c1);
    const [r2, g2, b2] = parse(c2);
    const blend = (a: number, b: number) =>
      Math.round(a + (b - a) * ratio)
        .toString(16)
        .padStart(2, "0");
    return `#${blend(r1, r2)}${blend(g1, g2)}${blend(b1, b2)}`;
  } catch {
    return c1;
  }
}
