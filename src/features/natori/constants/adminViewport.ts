import type { Viewport } from "next";

/**
 * 管理画面（ホーム画面に追加して standalone で開く想定）用の viewport。
 * viewportFit: "cover" がないと iOS で env(safe-area-inset-*) が 0 になり、
 * 下部タブがホームインジケーター（スワイプバー）に重なる。
 */
export const natoriAdminViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
