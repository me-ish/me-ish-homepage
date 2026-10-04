import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { NatoriAdminHeader } from "./NatoriAdminHeader";
import { NatoriAdminTabBar } from "./NatoriAdminTabBar";
import { NatoriToastProvider } from "./NatoriToast";
import type { NatoriAdminSection } from "./navItems";

type NatoriPageShellProps = {
  current: NatoriAdminSection;
  title: string;
  description?: string;
  /** Buttons on the right of the title. */
  actions?: React.ReactNode;
  /** Right-end slot of the header. */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

export function NatoriPageShell({
  current,
  title,
  description,
  actions,
  headerRight,
  children,
}: NatoriPageShellProps) {
  return (
    <NatoriToastProvider>
      {/* data-natori-admin: globals.css switches the font for the admin screens */}
      <div data-natori-admin className={natoriAdminUi.page}>
        <NatoriAdminHeader current={current} right={headerRight} />
        <main
          className={`${natoriAdminUi.container} ${natoriAdminUi.pageBody} pb-24 lg:pb-8`}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className={natoriAdminUi.pageTitle}>{title}</h1>
              {description ? (
                <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            ) : null}
          </div>
          {children}
        </main>
        <footer className="border-t border-zinc-200/80 pb-20 lg:pb-0">
          <p
            className={`${natoriAdminUi.container} py-5 text-xs text-zinc-600`}
          >
            © {new Date().getFullYear()} Natori / me-ish. All rights reserved.
          </p>
        </footer>
        <NatoriAdminTabBar current={current} />
      </div>
    </NatoriToastProvider>
  );
}
