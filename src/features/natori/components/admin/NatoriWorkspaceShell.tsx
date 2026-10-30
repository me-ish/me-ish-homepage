import Link from "next/link";
import { natoriAdminUi as ui } from "@/features/natori/constants/adminUi";
import { NatoriAdminFont } from "./NatoriAdminFont";
import { NatoriToastProvider } from "./NatoriToast";

/** Shell for pages opened from the case workspace (e.g. 実績): same header as the workspace, no old tab bar. */
export function NatoriWorkspaceShell({ title, backHref, children }: { title: string; backHref: string; children: React.ReactNode }) {
  return (
    <NatoriToastProvider>
      <div data-natori-admin className="min-h-screen bg-[#F7F7F8] pb-10 text-zinc-900">
        <NatoriAdminFont />
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href={backHref} className={`rounded-lg text-xl font-bold tracking-tight ${ui.focusRing}`}>
              natori<span className="text-pink-500">.</span>
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-[1440px] space-y-4 px-4 pt-4 sm:px-6">
          <Link href={backHref} className={ui.btnLink}>← ページへ戻る</Link>
          <h1 className="text-xl font-semibold">{title}</h1>
          {children}
        </main>
      </div>
    </NatoriToastProvider>
  );
}
