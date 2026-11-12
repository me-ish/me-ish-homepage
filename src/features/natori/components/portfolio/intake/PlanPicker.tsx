"use client";

// features/natori/components/portfolio/intake/PlanPicker.tsx
// 「描く範囲」カード（SD／胸上／膝〜腰上／全身）と、量産イラスト・それ以外・未定のチップ。
// 選択はフォーム state から作る派生表示で、選ぶと onPick で state を書き換える。
import {
  PORTFOLIO_PLAN_PICK_CARDS,
  PORTFOLIO_PLAN_PICK_CHIPS,
  PORTFOLIO_PLAN_PICK_CHIP_LABELS,
  parsePortfolioPlanPrice,
  type PortfolioPlanPick,
  type PortfolioPlanPickCard,
} from "@/features/natori/lib/portfolioPlanPicker";
import { portfolioPlanSample } from "@/features/natori/lib/portfolioPlanSamples";
import type { PortfolioPlan, PortfolioWork } from "@/features/natori/types/portfolio";
import { portfolioFormColors as c } from "../PortfolioFormStyles";
import ChoiceChip from "./ChoiceChip";

const FALLBACK_NAMES: Record<PortfolioPlanPickCard, string> = {
  sd: "SD",
  bust_up: "胸上",
  waist_up: "膝〜腰上",
  full_body: "全身",
};

/** 作例が無いときの淡い人型。描く範囲が広いほど背が高い。 */
const SILHOUETTE: Record<PortfolioPlanPickCard, { width: string; height: string; radius: string }> = {
  sd: { width: "72%", height: "38%", radius: "999px 999px 6px 6px" },
  bust_up: { width: "56%", height: "52%", radius: "999px 999px 6px 6px" },
  waist_up: { width: "44%", height: "68%", radius: "999px 999px 6px 6px" },
  full_body: { width: "30%", height: "84%", radius: "999px 999px 6px 6px" },
};

function formatPlanPrice(price: string): string {
  const amount = parsePortfolioPlanPrice(price);
  return amount === null ? price : `${amount.toLocaleString("ja-JP")}円〜`;
}

export default function PlanPicker({
  plans,
  works,
  value,
  onPick,
  invalid,
  describedBy,
}: {
  plans: readonly PortfolioPlan[];
  works: PortfolioWork[];
  value: PortfolioPlanPick | null;
  onPick: (pick: PortfolioPlanPick) => void;
  /** 入力エラーの移動先になったとき */
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <fieldset id="pf-plan-picker" tabIndex={-1} aria-invalid={invalid || undefined} aria-describedby={describedBy} className="scroll-mt-24 outline-none">
      <legend className="mb-1.5 flex items-center text-sm font-bold">
        描く範囲
        <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: c.surfaceSubtle, color: c.textSoft }}>
          あとで変更OK
        </span>
      </legend>
      <div className="grid grid-cols-4 gap-2">
        {PORTFOLIO_PLAN_PICK_CARDS.map((pick) => {
          const plan = plans.find((candidate) => candidate.id === pick);
          const name = plan?.name.trim() || FALLBACK_NAMES[pick];
          const sample = plan ? portfolioPlanSample(plan, works) : null;
          const checked = value === pick;
          const shape = SILHOUETTE[pick];
          return (
            <label
              key={pick}
              className="flex min-w-0 cursor-pointer flex-col items-center gap-1 border-2 p-1.5 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2"
              style={{
                borderRadius: "16px 12px 18px 11px / 12px 17px 11px 18px",
                borderColor: checked ? c.ink : c.formBorder,
                background: checked ? c.actionSoft : c.surface,
                boxShadow: checked ? `3px 3px 0 ${c.ink}` : "none",
                outlineColor: c.formBorderActive,
              }}
            >
              <input
                type="radio"
                name="pf-plan"
                value={pick}
                checked={checked}
                onChange={() => onPick(pick)}
                className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0 sr-only"
              />
              <span
                aria-hidden="true"
                className="relative flex aspect-square w-full items-end justify-center overflow-hidden rounded-lg"
                style={{ background: c.surfaceSubtle }}
              >
                {sample ? (
                  // アップロード画像は公開Storage URLなので next/image のhost設定に依存させない（料金表と同じ）
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sample.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span style={{ width: shape.width, height: shape.height, borderRadius: shape.radius, background: c.marker }} />
                )}
              </span>
              <span className="w-full break-keep text-[13px] font-black leading-tight sm:text-sm">{name}</span>
              {plan ? (
                <span className="w-full text-[11px] font-bold leading-tight sm:text-xs" style={{ color: c.textSoft }}>
                  {formatPlanPrice(plan.price)}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PORTFOLIO_PLAN_PICK_CHIPS.map((pick) => (
          <ChoiceChip key={pick} type="radio" name="pf-plan" checked={value === pick} onChange={() => onPick(pick)}>
            {PORTFOLIO_PLAN_PICK_CHIP_LABELS[pick]}
          </ChoiceChip>
        ))}
      </div>
    </fieldset>
  );
}
