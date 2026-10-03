import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { NatoriAdminHeader } from "./NatoriAdminHeader";
import { NatoriAdminTabBar } from "./NatoriAdminTabBar";
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
    <div className={natoriAdminUi.page}>
      <NatoriAdminHeader current={current} right={headerRight} />
      <main className={`${natoriAdminUi.container} ${natoriAdminUi.pageBody} pb-24 md:pb-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className={natoriAdminUi.pageTitle}>{title}</h1>
            {description ? <p className={natoriAdminUi.caption}>{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </main>
      <footer className="border-t border-gray-200 pb-20 md:pb-0">
        <p className={`${natoriAdminUi.container} py-4 text-xs text-gray-600`}>
          © {new Date().getFullYear()} Natori / me-ish. All rights reserved.
        </p>
      </footer>
      <NatoriAdminTabBar current={current} />
    </div>
  );
}
