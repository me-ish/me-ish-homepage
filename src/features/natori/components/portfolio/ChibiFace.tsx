// features/natori/components/portfolio/ChibiFace.tsx
// プレースホルダー用ちびキャラSVG。実際のイラストに差し替えるまでのダミー。
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";

type Props = {
  skin?: string;
  hair?: string;
  accent?: string;
  size?: number;
};

export default function ChibiFace({
  skin = "#FFE3D1",
  hair = "#B98BD8",
  accent = c.pink,
  size = 96,
}: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="56" r="34" fill={skin} />
      <path
        d="M16 48 C16 12 84 12 84 48 C84 34 66 20 50 20 C34 20 16 34 16 48 Z"
        fill={hair}
      />
      <circle cx="16" cy="46" r="9" fill={hair} />
      <circle cx="84" cy="46" r="9" fill={hair} />
      <circle cx="37" cy="58" r="4" fill={c.ink} />
      <circle cx="63" cy="58" r="4" fill={c.ink} />
      <circle cx="33" cy="66" r="6" fill={accent} opacity="0.55" />
      <circle cx="67" cy="66" r="6" fill={accent} opacity="0.55" />
      <path
        d="M43 70 Q50 76 57 70"
        stroke={c.ink}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
