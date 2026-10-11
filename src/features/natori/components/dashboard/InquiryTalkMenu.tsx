"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Calculator, Mail, PackageCheck, Palette, Plus } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { buildTalkMenu, type TalkMenuItem } from "@/features/natori/lib/talkMenu";
import type { NatoriProject } from "@/features/natori/types/projects";
import type { OrderMailKind } from "./OrderMailPanel";

type Props = {
  project: NatoriProject;
  readOnly: boolean;
  busy: boolean;
  /** An unsent reply or attachment is waiting in the thread below. */
  hasDraft?: boolean;
  estimateHref?: string;
  projectsHref?: string;
  onOpenMail: (kind: OrderMailKind) => void;
};

const icons = { estimate: Calculator, rough: Palette, payment: Mail, delivery: PackageCheck } as const;

/** "＋" menu on the staff talk screen: shortcuts to the existing quote / payment / delivery screens, with the reason when one is not available yet. */
export default function InquiryTalkMenu({ project, readOnly, busy, hasDraft = false, estimateHref, projectsHref, onOpenMail }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const menu = buildTalkMenu({ status: project.status, paymentConfirmedAt: project.paymentConfirmedAt, quoteAcceptedAt: project.quoteAcceptedAt, hasEstimateLink: Boolean(estimateHref), readOnly });

  // Leaving the conversation unmounts the thread, which drops an unsent reply or attachment.
  const confirmLeave = () => !hasDraft || window.confirm("入力中の返信や添付は、この画面を離れると消えます。移動しますか？");

  const action = (item: TalkMenuItem) => {
    const Icon = icons[item.key];
    const className = `${natoriAdminUi.btnSecondary} w-full justify-start ${menu.recommended === item.key ? "border-[#EC4899]" : ""}`;
    const body = <><Icon className="h-4 w-4 shrink-0" aria-hidden />{item.label}</>;
    if (item.key === "estimate" && estimateHref) return <Link href={estimateHref} className={className} onClick={event => { if (!confirmLeave()) event.preventDefault(); }}>{body}</Link>;
    if (item.key === "rough") return <button type="button" className={className} onClick={() => { setOpen(false); document.getElementById("consultation-reply")?.focus(); }}>{body}</button>;
    if (item.key === "payment") return <button type="button" className={className} disabled={busy} onClick={() => { if (!confirmLeave()) return; setOpen(false); onOpenMail("payment"); }}>{body}</button>;
    return <Link href={projectsHref ?? "/natori/projects"} className={className} onClick={event => { if (!confirmLeave()) event.preventDefault(); }}>{body}</Link>;
  };

  return (
    <div className="sticky top-0 z-10 -mt-1 mb-3 bg-white pb-2">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} className={natoriAdminUi.btnSecondary}>
        <Plus className="h-4 w-4" aria-hidden />
        送る・進める
      </button>
      {open ? (
        <div id={panelId} className="mt-2 max-h-[50dvh] space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          <p className="rounded-xl bg-pink-50 px-3 py-2 text-sm leading-6 text-zinc-900">{menu.tip}</p>
          <ul className="space-y-2">
            {menu.items.map(item => (
              <li key={item.key}>
                {item.reason === null ? (
                  <>{action(item)}{item.hint ? <p className={`${natoriAdminUi.caption} mt-1 px-1`}>{item.hint}</p> : null}</>
                ) : (
                  <div className="rounded-xl border border-dashed border-zinc-300 px-3 py-2">
                    <p className="text-sm font-semibold text-zinc-700">{item.label}</p>
                    <p className={natoriAdminUi.caption}>{item.reason}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
