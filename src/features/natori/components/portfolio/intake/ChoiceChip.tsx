"use client";

// features/natori/components/portfolio/intake/ChoiceChip.tsx
// radio / checkbox を丸いチップの見た目で出す。input は DOM に残し、読み上げ・キーボード・テストは
// これまでどおり radio / checkbox として扱える。
import type { ReactNode } from "react";
import { portfolioFormColors as c } from "../PortfolioFormStyles";

export default function ChoiceChip({
  type,
  name,
  checked,
  onChange,
  children,
  id,
}: {
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
  id?: string;
}) {
  return (
    <label
      className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 px-3 text-sm font-bold"
      style={{
        color: c.text,
        borderColor: checked ? c.formBorderActive : c.formBorder,
        background: checked ? c.surfaceSubtle : c.surface,
      }}
    >
      <input
        id={id}
        type={type}
        name={name}
        checked={checked}
        onChange={onChange}
        className="pf-choice-control pf-cute-focus h-4 w-4 shrink-0"
      />
      {children}
    </label>
  );
}
