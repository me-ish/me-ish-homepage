import "server-only";

// features/natori/server/portfolioShareImage.tsx
// /natori/portfolio をSNSで共有したときのカード画像（1200x630）。
// スライドの1枚目（なければ公開中の最初の作品）をテープ付きのカードで見せ、
// 呼び名・用件・受付状況を添える。作品を差し替えれば共有画像も追従する。
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import {
  PORTFOLIO_PAGE_PURPOSE,
  portfolioBrandSubName,
  portfolioShareArtwork,
} from "@/features/natori/lib/portfolioShare";
import type { PortfolioContent } from "@/features/natori/types/portfolio";

export const PORTFOLIO_SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

const FETCH_TIMEOUT_MS = 4000;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const FONT_FAMILY = "Zen Maru Gothic";
const ART = { width: 430, height: 506 } as const;
const ICON_SIZE = 96;

type ShareContent = Pick<
  PortfolioContent,
  | "heroTitleAccent"
  | "heroTitleTail"
  | "artistName"
  | "heroImages"
  | "heroImage"
  | "works"
  | "aboutImage"
  | "commissionOpen"
>;

let brandFont: Promise<Buffer | null> | null = null;

/** 公開ページと同じ Zen Maru Gothic。読めなければ文字なしの画像にする。 */
function loadBrandFont(): Promise<Buffer | null> {
  brandFont ??= readFile(join(process.cwd(), "public/fonts/ZenMaruGothic-Bold.ttf")).catch(() => null);
  return brandFont;
}

/** 編集画面で登録された公開画像だけを取りに行く。開発中はローカルの http も許可する。 */
async function fetchImageBytes(url: string): Promise<Buffer | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const allowHttp = process.env.NODE_ENV !== "production";
  if (parsed.protocol !== "https:" && !(allowHttp && parsed.protocol === "http:")) return null;
  try {
    const response = await fetch(parsed, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.byteLength > MAX_IMAGE_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

/** WebP なども扱えるよう、カードに収まる大きさの PNG に変換してから埋め込む。 */
async function pngDataUrl(url: string | null, width: number, height: number): Promise<string | null> {
  if (!url) return null;
  const bytes = await fetchImageBytes(url);
  if (!bytes) return null;
  try {
    const png = await sharp(bytes)
      .resize(width * 2, height * 2, { fit: "cover", position: sharp.strategy.attention })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function renderPortfolioShareImage(content: ShareContent): Promise<ImageResponse> {
  const accent = content.heroTitleAccent.trim();
  const tail = content.heroTitleTail.trim();
  const subName = portfolioBrandSubName(content);
  const open = content.commissionOpen;

  const [art, icon, font] = await Promise.all([
    pngDataUrl(portfolioShareArtwork(content), ART.width, ART.height),
    pngDataUrl(content.aboutImage, ICON_SIZE, ICON_SIZE),
    loadBrandFont(),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: art ? "flex-start" : "center",
          gap: 64,
          paddingLeft: 72,
          paddingRight: art ? 60 : 72,
          backgroundImage: `linear-gradient(135deg, ${c.surface} 0%, ${c.surfaceSubtle} 45%, #FDE7F1 100%)`,
          color: c.text,
          ...(font ? { fontFamily: FONT_FAMILY } : {}),
        }}
      >
        {art ? (
          <div
            style={{
              position: "relative",
              display: "flex",
              padding: 14,
              borderRadius: 20,
              background: c.surface,
              boxShadow: "0 18px 40px rgba(36,32,39,0.14)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art} width={ART.width} height={ART.height} alt="" style={{ borderRadius: 12 }} />
            <div
              style={{
                position: "absolute",
                top: -16,
                left: (ART.width + 28 - 150) / 2,
                width: 150,
                height: 36,
                borderRadius: 3,
                background: c.actionSoft,
                opacity: 0.92,
                transform: "rotate(-3deg)",
              }}
            />
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: art ? "flex-start" : "center",
            gap: 18,
            ...(art ? { flexGrow: 1, flexShrink: 1, flexBasis: 0 } : {}),
          }}
        >
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={icon}
              width={ICON_SIZE}
              height={ICON_SIZE}
              alt=""
              style={{
                borderRadius: ICON_SIZE / 2,
                border: `5px solid ${c.surface}`,
                boxShadow: "0 8px 18px rgba(36,32,39,0.12)",
              }}
            />
          ) : null}
          {font ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: art ? "flex-start" : "center", gap: 18 }}>
              {subName ? (
                <div style={{ fontSize: 22, letterSpacing: 4, color: c.actionTextSmall }}>{subName.toUpperCase()}</div>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", fontSize: 66, lineHeight: 1.15 }}>
                <span>{accent}</span>
                <span style={{ color: c.actionText }}>{tail}</span>
              </div>
              <div style={{ fontSize: 34, color: c.textSoft }}>{PORTFOLIO_PAGE_PURPOSE}</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 8,
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 24,
                  paddingRight: 24,
                  borderRadius: 999,
                  fontSize: 26,
                  color: open ? c.success : c.textSoft,
                  background: open ? c.successSoft : c.surface,
                  border: `2px solid ${open ? c.success : c.borderSubtle}`,
                }}
              >
                {open ? <div style={{ width: 14, height: 14, borderRadius: 7, background: c.success }} /> : null}
                <span>{open ? "受付中" : "受付停止中"}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...PORTFOLIO_SHARE_IMAGE_SIZE,
      ...(font ? { fonts: [{ name: FONT_FAMILY, data: font, weight: 700 as const, style: "normal" as const }] } : {}),
      headers: { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" },
    },
  );
}
