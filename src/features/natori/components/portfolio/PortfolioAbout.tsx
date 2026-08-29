// features/natori/components/portfolio/PortfolioAbout.tsx
import Image from "next/image";
import {
  isPortfolioXLink,
  portfolioColors as c,
} from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent, PortfolioVariant } from "@/features/natori/types/portfolio";
import ChibiFace from "./ChibiFace";
import PortfolioSnsLink from "./PortfolioSnsLink";
import { fontEnStyle } from "./portfolioFonts";

/** X の URL から @ハンドルを取り出す（取れなければリンクのラベルで代用） */
function xHandle(href: string, fallback: string): string {
  try {
    const first = new URL(href).pathname.split("/").filter(Boolean)[0];
    return first ? `@${first}` : fallback;
  } catch {
    return fallback;
  }
}

export default function PortfolioAbout({
  content,
  variant = "full",
  flatPlaceholders,
}: {
  content: PortfolioContent;
  variant?: PortfolioVariant;
  /** アイコン未設定時のプレースホルダーをキャラSVGではなくベタ塗りにする（デモ用） */
  flatPlaceholders?: boolean;
}) {
  // showcase ではXも直接連絡手段になり得るためリンクを出さない
  const xLink = variant === "showcase" ? undefined : content.socialLinks.find(isPortfolioXLink);
  // プロフィール欄の名前はヘッダー/ヒーローとは独立に設定できる。
  // 未設定（旧データ）のときは従来どおりサイト名を表示する
  const profileName = content.profileName.trim() || content.artistName;
  return (
    <section id="about" className="py-16" style={{ background: c.surfaceSubtle }}>
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 md:grid-cols-3">
        <div className="flex flex-col items-center md:col-span-1">
          {/* プロフィールアイコン。編集画面から画像を設定すると差し替わる */}
          <div
            className="rounded-full p-6"
            style={{ background: c.surface, boxShadow: `0 12px 24px ${c.shadowSoft}` }}
          >
            {content.aboutImage ? (
              <div className="relative h-[140px] w-[140px] overflow-hidden rounded-full">
                <Image
                  src={content.aboutImage}
                  alt={`${content.artistName} アイコン`}
                  fill
                  sizes="140px"
                  className="object-cover"
                />
              </div>
            ) : flatPlaceholders ? (
              <span
                aria-hidden
                className="block h-[140px] w-[140px] rounded-full"
                style={{ background: c.surfaceSubtle }}
              />
            ) : (
              <ChibiFace size={140} skin="#FDE0D0" hair="#9AB8F0" accent={c.accent} />
            )}
          </div>
          {/* 名前とX。フッターにあったXリンクはここへ移設 */}
          <p className="mt-5 text-center text-2xl font-black tracking-wide">{profileName}</p>
          {xLink ? (
            <PortfolioSnsLink
              href={xLink.href}
              label="X"
              className="pf-cute-focus mt-3 inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-black hover:brightness-95"
              style={{
                borderColor: c.highlightDisplay,
                color: c.highlightDisplay,
                background: c.highlight,
              }}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.265 5.64 5.899-5.64Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
              <span style={fontEnStyle}>{xHandle(xLink.href, xLink.label)}</span>
            </PortfolioSnsLink>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <h2 className="mb-3 text-2xl font-black">プロフィール</h2>
          {content.aboutParagraphs.map((paragraph, index) => (
            <p key={index} className="mb-4 leading-relaxed" style={{ color: c.textSoft }}>
              {paragraph}
            </p>
          ))}
          <div className="rounded-xl p-5" style={{ background: c.surface }}>
            <p className="mb-3 font-bold">対応内容</p>
            <ul className="flex flex-wrap gap-2">
              {content.services.map((service) => (
                <li
                  key={service}
                  className="rounded-full border-2 px-3 py-1 text-xs font-bold md:text-sm"
                  style={{ borderColor: c.borderStrong, color: c.textSoft }}
                >
                  {service}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
