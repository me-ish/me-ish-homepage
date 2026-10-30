import Link from "next/link";
import { natoriAdminUi as ui } from "@/features/natori/constants/adminUi";
import { workspaceLook as look } from "@/features/natori/constants/workspaceLook";
import { WavyUnderline } from "../caseWorkspace/WavyUnderline";
import { NatoriAdminFont } from "./NatoriAdminFont";
import { NatoriToastProvider } from "./NatoriToast";

/** Shell for pages opened from the case workspace (e.g. 実績): same header as the workspace, no old tab bar. */
export function NatoriWorkspaceShell({ title, backHref, children }: { title: string; backHref: string; children: React.ReactNode }) {
  return (
    <NatoriToastProvider>
      <div data-natori-admin className={`${look.page} pb-10`}>
        <NatoriAdminFont />
        <header className={look.header}>
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href={backHref} className={`rounded-lg ${look.brand} ${ui.focusRing}`}>
              natori<span className="text-pink-500">.</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] space-y-4 px-4 pt-4 sm:px-6">
          <Link href={backHref} className={ui.btnLink}>← ページへ戻る</Link>
          <h1 className={`text-xl ${look.title}`}>{title}<WavyUnderline className="mt-0.5" /></h1>
          {children}
        </main>
      </div>
    </NatoriToastProvider>
  );
}
