import "server-only";
import { after } from "next/server";
import { dispatchAcceptanceNotifications } from "./acceptanceNotifications";

/** Response completion is independent of provider availability. Durable jobs survive process exit. */
export function scheduleAcceptanceNotifications(ids: string[]): void {
  if (!ids.length) return;
  try { after(() => dispatchAcceptanceNotifications(ids)); }
  catch { console.error("[natori-notification] scheduling_interrupted"); }
}
