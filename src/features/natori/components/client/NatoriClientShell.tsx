// features/natori/components/client/NatoriClientShell.tsx
// 依頼者がメールのリンクから開くページ（見積もり承諾・納品・相談）の共通の枠。
// 公開ページと同じ白地・ピンク・丸ゴシックの見た目にそろえる。
import type { ReactNode } from "react";
import { Clock, Link2Off, TriangleAlert } from "lucide-react";
import { natoriClientUi as ui } from "@/features/natori/constants/clientUi";

// The root layout already loads Zen Maru Gothic through next/font (--font-zen),
// so no extra font module is imported here. The fallback keeps the family when
// the variable is absent (isolated test shells).
const clientFontFamily =
  'var(--font-zen, "Zen Maru Gothic"), "Zen Maru Gothic", system-ui, -apple-system, "Hiragino Sans", sans-serif';

export default function NatoriClientShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={ui.page} style={{ fontFamily: clientFontFamily }}>
      <header className={ui.header}>
        <div className={`${ui.container} flex h-14 items-center`}>
          <span className={ui.brand}>
            ナトリの<span className={ui.brandAccent}>あとりえ</span>
          </span>
        </div>
      </header>
      <main className={`${ui.container} pb-16 pt-8 sm:pb-20 sm:pt-12`}>
        <div className="text-center">
          <h1 className={ui.title}>{title}</h1>
          {subtitle ? <p className={`mt-2 ${ui.phrase} ${ui.body} ${ui.muted}`}>{subtitle}</p> : null}
        </div>
        <div className="mt-6 sm:mt-8">{children}</div>
      </main>
    </div>
  );
}

const noticeIcons = { link: Link2Off, clock: Clock, alert: TriangleAlert } as const;

/** Invalid / expired / unavailable link states. Title and body copy stay with each page. */
export function NatoriClientNotice({
  icon,
  title,
  body,
}: {
  icon: keyof typeof noticeIcons;
  title: string;
  body: string;
}) {
  const Icon = noticeIcons[icon];
  return (
    <div className={`${ui.card} mx-auto max-w-lg text-center`}>
      <span
        aria-hidden="true"
        className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF0F6] text-[#BE185D]"
      >
        <Icon className="h-6 w-6" />
      </span>
      <h2 className={`mt-4 ${ui.heading}`}>{title}</h2>
      <p className={`mt-2 ${ui.phrase} ${ui.body} ${ui.muted}`}>{body}</p>
    </div>
  );
}
