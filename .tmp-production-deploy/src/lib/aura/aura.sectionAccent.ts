// src/lib/aura/aura.sectionAccent.ts

type Rgb = { r: number; g: number; b: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function parseColorToRgb(input: string): Rgb | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  // #RGB / #RRGGBB
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full =
      hex.length === 3 ? hex.split("").map((c) => c + c).join("") :
      hex.length === 6 ? hex :
      null;
    if (!full) return null;

    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return { r, g, b };
  }

  // rgb()/rgba()
  const m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(",").map((x) => x.trim());
    if (parts.length >= 3) {
      const r = Number(parts[0]);
      const g = Number(parts[1]);
      const b = Number(parts[2]);
      if ([r, g, b].every((v) => Number.isFinite(v))) {
        return { r: clamp(r, 0, 255), g: clamp(g, 0, 255), b: clamp(b, 0, 255) };
      }
    }
  }

  return null;
}

function rgbToHsl({ r, g, b }: Rgb) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;

  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case R:
        h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
        break;
      case G:
        h = ((B - R) / d + 2) * 60;
        break;
      case B:
        h = ((R - G) / d + 4) * 60;
        break;
    }
  }

  return { h, s, l };
}

function rgbToHex({ r, g, b }: Rgb) {
  const to2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0, g1 = 0, b1 = 0;
  if (hh < 60) [r1, g1, b1] = [c, x, 0];
  else if (hh < 120) [r1, g1, b1] = [x, c, 0];
  else if (hh < 180) [r1, g1, b1] = [0, c, x];
  else if (hh < 240) [r1, g1, b1] = [0, x, c];
  else if (hh < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  return {
    r: (r1 + m) * 255,
    g: (g1 + m) * 255,
    b: (b1 + m) * 255,
  };
}

function shiftHue(color: string, deg: number) {
  const rgb = parseColorToRgb(color);
  if (!rgb) return color; // パースできない色はそのまま
  const { h, s, l } = rgbToHsl(rgb);
  const shifted = hslToRgb(h + deg, s, l);
  return rgbToHex(shifted); // ✅ hexで返す
}

export function sectionAccentColor(base: string, sectionType: string) {
  // “近似色”なのでズラしは小さく
  const map: Record<string, number> = {
    hero: 0,
    about: 0,
    works: 18,
    services: -14,
    skills: 28,
    contact: -22,
  };
  const deg = map[sectionType] ?? 0;
  return shiftHue(base, deg);
}
