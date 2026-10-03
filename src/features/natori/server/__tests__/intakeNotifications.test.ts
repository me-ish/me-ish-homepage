import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/supabaseAdmin",()=>({supabaseAdmin:()=>({})}));
import { buildAcceptanceNotificationPayload } from "../acceptanceNotifications";
const snapshot={title:"Original project",clientName:"Synthetic",clientEmail:"client@example.invalid",receipt:"c1a855ca-9478-4a8d-baa1-123456789abc"};
afterEach(()=>vi.unstubAllEnvs());
describe("separate intake notices use Phase N immutable payload",()=>{
 it("renders two distinct recipients with receipt and client no-reapply guidance",()=>{
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO","artist@example.invalid");vi.stubEnv("NATORI_ORDER_MAIL_FROM","Fixture <sender@example.invalid>");
  const artist=buildAcceptanceNotificationPayload({purpose:"intake_artist",snapshot,payload:null}),client=buildAcceptanceNotificationPayload({purpose:"intake_client",snapshot,payload:null});
  expect(artist.to).toEqual(["artist@example.invalid"]);expect(artist.reply_to).toBe(snapshot.clientEmail);
  expect(client.to).toEqual([snapshot.clientEmail]);expect(client.reply_to).toBe("artist@example.invalid");
  expect(client.text).toContain(snapshot.receipt);expect(client.text).toContain("2〜3日");expect(client.text).toContain("再応募は不要");
 });
 it("retry uses exact frozen payload after mail configuration changes and snapshot projection changes",()=>{
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO","artist@example.invalid");vi.stubEnv("NATORI_ORDER_MAIL_FROM","Fixture <sender@example.invalid>");
  const payload=buildAcceptanceNotificationPayload({purpose:"intake_client",snapshot,payload:null});
  vi.stubEnv("NATORI_PORTFOLIO_CONTACT_TO","changed@example.invalid");vi.stubEnv("NATORI_ORDER_MAIL_FROM","");
  expect(buildAcceptanceNotificationPayload({purpose:"intake_client",snapshot:{},payload})).toEqual(payload);
 });
});
