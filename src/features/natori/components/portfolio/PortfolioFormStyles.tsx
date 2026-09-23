import { portfolioColors } from "@/features/natori/constants/portfolioContent";

// フォーム内だけで使い、Hero / Gallery / showcase の色は変えない。
export const portfolioFormColors = {
  ...portfolioColors,
  borderSubtle: "#E3E0E2",
  formBorder: "#878287",
  formBorderActive: portfolioColors.accentText,
};

export default function PortfolioFormStyles() {
  const c = portfolioFormColors;
  return (
    <style>{`
      .pf-commission-form .pf-form-control,
      .pf-commission-form .pf-choice-control { border-color: ${c.formBorder}; }
      .pf-commission-form .pf-choice-control:checked {
        border-color: ${c.formBorderActive};
        background-color: ${c.formBorderActive};
      }
      .pf-commission-form :where(input, select, textarea, button, a, summary):focus-visible {
        outline-color: ${c.formBorderActive};
      }
      .pf-commission-form :where(.pf-form-control, .pf-choice-control):focus-visible {
        border-color: ${c.formBorderActive};
      }
      .pf-commission-form [aria-invalid="true"] { border-color: ${c.error}; }
      .pf-commission-form :where(input, select, textarea, [tabindex="-1"]) { scroll-margin-top: 140px; }
    `}</style>
  );
}
