// src/app/aura/form/page.tsx
// Alias: /aura/form → /aiPortfolio/form (内部実装は aiPortfolio、公開URLは /aura に統一)
import { permanentRedirect } from "next/navigation";

export default function AuraFormRedirect() {
  permanentRedirect("/aiPortfolio/form");
}
