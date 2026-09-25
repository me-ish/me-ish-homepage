"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { portfolioColors as c } from "@/features/natori/constants/portfolioContent";
import type { PortfolioContent } from "@/features/natori/types/portfolio";
import type { NatoriInquiryModeV1 } from "@/features/natori/types/request";
import PortfolioCommissionForm from "./PortfolioCommissionForm";
import {
  OPEN_PORTFOLIO_INQUIRY,
  PORTFOLIO_INQUIRY_VISIBILITY,
  type PortfolioInquiryOpenDetail,
} from "./portfolioInquiryEvents";
import { portfolioFontEn, portfolioFontJp } from "./portfolioFonts";

const historyKey = "natoriPortfolioInquiry";

export default function PortfolioInquiryDialog({
  content,
  demoMode,
  structuredIntake,
}: {
  content: PortfolioContent;
  demoMode?: boolean;
  structuredIntake?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<NatoriInquiryModeV1>("consultation");
  const [opening, setOpening] = useState(0);
  const [fromPlan, setFromPlan] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);

  const show = useCallback((detail: PortfolioInquiryOpenDetail = {}) => {
    if (!content.commissionOpen) return;
    const selectedMode = detail.mode ?? (detail.fromPlan ? "quote" : undefined);
    if (selectedMode) setMode(selectedMode);
    setFromPlan(Boolean(detail.fromPlan));
    setOpening((current) => current + 1);
    if (!openRef.current) {
      openRef.current = true;
      // A history entry lets the phone back button close the dialog first.
      if (!window.history.state?.[historyKey]) {
        window.history.pushState({ ...window.history.state, [historyKey]: true }, "", window.location.href);
      }
    }
    setOpen(true);
  }, [content.commissionOpen]);

  const close = useCallback(() => {
    if (window.history.state?.[historyKey]) {
      window.history.back();
    } else {
      openRef.current = false;
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    const onOpen = (event: Event) => show((event as CustomEvent<PortfolioInquiryOpenDetail>).detail);
    const onLink = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[href="#form"]');
      if (!link || !content.commissionOpen) return;
      event.preventDefault();
      triggerRef.current = link;
      show();
    };
    const onHistory = () => {
      const nowOpen = Boolean(window.history.state?.[historyKey]);
      openRef.current = nowOpen;
      setOpen(nowOpen);
    };
    window.addEventListener(OPEN_PORTFOLIO_INQUIRY, onOpen);
    document.addEventListener("click", onLink, true);
    window.addEventListener("popstate", onHistory);
    if (window.location.hash === "#form" && content.commissionOpen) show();
    return () => {
      window.removeEventListener(OPEN_PORTFOLIO_INQUIRY, onOpen);
      document.removeEventListener("click", onLink, true);
      window.removeEventListener("popstate", onHistory);
    };
  }, [content.commissionOpen, show]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(PORTFOLIO_INQUIRY_VISIBILITY, { detail: open }));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const keepFocusInside = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return (
    <>
      <section id="form" className="mx-auto max-w-3xl px-5 py-14 text-center md:py-20">
        <h2 className="text-2xl font-black md:text-3xl">ご相談・ご依頼</h2>
        <p className="mt-3 leading-relaxed" style={{ color: c.textSoft }}>
          {content.commissionOpen
            ? "イメージが決まっていなくても大丈夫。まずは気軽にお話を聞かせてください。"
            : "現在コミッションは停止中です。再開まで今しばらくお待ちください。"}
        </p>
        {content.commissionOpen && (
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={(event) => { triggerRef.current = event.currentTarget; show({ mode: "consultation" }); }} className="pf-cute-focus min-h-[48px] rounded-full border-2 px-6 py-2 font-bold" style={{ borderColor: c.actionDisplay, background: c.action, color: c.onAction }}>
              まず相談したい
            </button>
            <button type="button" onClick={(event) => { triggerRef.current = event.currentTarget; show({ mode: "quote" }); }} className="pf-cute-focus min-h-[48px] rounded-full border-2 px-6 py-2 font-bold" style={{ borderColor: c.borderStrong, background: c.surface, color: c.text }}>
              見積もりをお願いしたい
            </button>
          </div>
        )}
      </section>
      {/* Keep the form mounted through close/open so typed text and File objects survive. */}
      <Dialog.Root open={open} modal={false} onOpenChange={(next) => { if (!next) close(); }}>
        <Dialog.Portal forceMount>
          <div aria-hidden="true" onClick={close} className={`fixed inset-0 z-[59] bg-black/50 ${open ? "" : "hidden"}`} />
          <Dialog.Content
            ref={dialogRef}
            forceMount
            aria-hidden={!open}
            aria-modal={open}
            aria-describedby={undefined}
            onKeyDown={keepFocusInside}
            onCloseAutoFocus={(event) => {
              if (triggerRef.current?.isConnected) {
                event.preventDefault();
                triggerRef.current.focus();
              }
            }}
            className={`${portfolioFontJp.variable} ${portfolioFontEn.variable} ${portfolioFontJp.className} pf-portfolio-root pf-inquiry-dialog fixed inset-x-0 bottom-0 top-auto z-[60] flex max-h-[94dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl border-0 bg-white p-0 shadow-2xl data-[state=closed]:hidden md:left-1/2 md:top-1/2 md:bottom-auto md:max-h-[min(90dvh,850px)] md:max-w-[720px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl`}
          >
            <div className="flex shrink-0 items-center justify-between border-b px-5 py-3 md:px-8" style={{ borderColor: c.borderSubtle }}>
              <Dialog.Title className="text-lg font-black">ご相談・ご依頼</Dialog.Title>
              <button type="button" className="pf-cute-focus grid h-11 w-11 place-items-center rounded-full text-2xl" onClick={close} aria-label="フォームを閉じる">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]" data-inquiry-scroll>
              <PortfolioCommissionForm content={content} demoMode={demoMode} structuredIntake={structuredIntake} initialMode={mode} opening={opening} fromPlan={fromPlan} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
