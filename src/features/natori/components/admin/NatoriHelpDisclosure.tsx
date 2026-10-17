import type { ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";

/**
 * 使い方の説明文を常時出さず、押したときだけ開く小さな折りたたみ。
 * 慣れた後は読まない注意書きで画面が長くならないようにする。
 */
export function NatoriHelpDisclosure({ label, children, className = "" }: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={`group min-w-0 ${className}`}>
      <summary className={`inline-flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-md text-xs font-semibold text-zinc-600 marker:hidden hover:text-zinc-900 [&::-webkit-details-marker]:hidden ${natoriAdminUi.focusRing}`}>
        <Info className="h-3.5 w-3.5" aria-hidden />
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
      </summary>
      <div className={`mt-1 max-w-2xl space-y-1 rounded-xl bg-zinc-50 p-3 ${natoriAdminUi.caption}`}>
        {children}
      </div>
    </details>
  );
}
