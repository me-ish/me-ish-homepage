"use client";

import { useEffect } from "react";
import { natoriAdminFont } from "./adminFont";

/**
 * Puts the admin font variable on <body> while an admin page is open, so
 * dialogs and toasts rendered outside the page shell use the same font.
 */
export function NatoriAdminFontScope() {
  useEffect(() => {
    const { body } = document;
    body.classList.add(natoriAdminFont.variable);
    return () => body.classList.remove(natoriAdminFont.variable);
  }, []);
  return null;
}
