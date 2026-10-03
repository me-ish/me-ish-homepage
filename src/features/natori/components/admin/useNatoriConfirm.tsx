"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NatoriConfirmDialog } from "./NatoriConfirmDialog";

export type NatoriConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "primary";
  withReason?: { label: string; placeholder?: string };
};

export type NatoriConfirmResult = { reason: string };

/**
 * Promise-based replacement for window.confirm / window.prompt.
 * `await confirm(...)` resolves to `null` when cancelled (Esc, backdrop, キャンセル)
 * and to `{ reason }` when confirmed (reason is "" unless `withReason` was typed into).
 * Render `confirmDialog` once in the component that calls `confirm`.
 */
export function useNatoriConfirm() {
  const [options, setOptions] = useState<NatoriConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((result: NatoriConfirmResult | null) => void) | null>(null);

  const settle = useCallback((result: NatoriConfirmResult | null) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback((next: NatoriConfirmOptions) => {
    resolver.current?.(null);
    return new Promise<NatoriConfirmResult | null>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
      setOpen(true);
    });
  }, []);

  useEffect(() => () => {
    resolver.current?.(null);
    resolver.current = null;
  }, []);

  const confirmDialog = options ? (
    <NatoriConfirmDialog
      open={open}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      tone={options.tone}
      withReason={options.withReason}
      onCancel={() => settle(null)}
      onConfirm={(reason) => settle({ reason })}
    />
  ) : null;

  return { confirm, confirmDialog };
}
