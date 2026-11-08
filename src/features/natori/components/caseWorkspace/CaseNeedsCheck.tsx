import type { ReactNode } from "react";
import { workspaceLook as look } from "../../constants/workspaceLook";

/** 「要確認」の札。色だけに頼らないよう、札の中に必ず「要確認」と書く。読み上げでは「要確認：…」の一文になる。 */
export function CaseNeedsCheck({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`${look.needsCheck} ${className}`}>
    <span className={look.needsCheckTag}>要確認<span className="sr-only">：</span></span>
    <span className="min-w-0">{children}</span>
  </span>;
}
