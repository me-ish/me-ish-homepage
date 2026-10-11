"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Calculator, Mail, PackageCheck, Paperclip, Plus } from "lucide-react";
import { natoriAdminUi } from "@/features/natori/constants/adminUi";
import { buildTalkMenu, type TalkMenuItem } from "@/features/natori/lib/talkMenu";
import type { NatoriProject } from "@/features/natori/types/projects";
import type { OrderMailKind } from "./OrderMailPanel";

type Props = {
  project: NatoriProject;
  readOnly: boolean;
  busy: boolean;
  estimateHref?: string;
  projectsHref?: string;
  onOpenMail: (kind: OrderMailKind) => void;
};

const icons = { estimate: Calculator, payment: Mail, delivery: PackageCheck } as const;

/** "＋" menu on the staff talk screen: shortcuts to the existing quote / payment / delivery screens, with the reason when one is not available yet. */
export default function InquiryTalkMenu({ project, readOnly, busy, estimateHref, projectsHref, onOpenMail }: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const menu = buildTalkMenu({ status: project.status, paymentConfirmedAt: project.paymentConfirmedAt, hasEstimateLink: Boolean(estimateHref), readOnly });

  const action = (item: TalkMenuItem) => {
    const Icon = icons[item.key];
    const className = `${natoriAdminUi.btnSecondary} w-full justify-start ${menu.recommended === item.key ? "border-[#EC4899]" : ""}`;
    const body = <><Icon className="h-4 w-4 shrink-0" aria-hidden />{item.label}</>;
    if (item.key === "estimate" && estimateHref) return <Link href={estimateHref} className={className}>{body}</Link>;
    if (item.key === "payment") return <button type="button" className={className} disabled={busy} onClick={() => { setOpen(false); onOpenMail("payment"); }}>{body}</button>;
    return <Link href={projectsHref ?? "/natori/projects"} className={className}>{body}</Link>;
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
            {!readOnly ? (
              <li className="flex items-start gap-2 rounded-xl bg-zinc-50 px-3 py-2">
                <Paperclip className="mt-1 h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                <p className={natoriAdminUi.caption}>ラフや資料は、下の入力欄の添付からいつでも送れます。ラフ専用の提出は次の段階で追加します。</p>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
