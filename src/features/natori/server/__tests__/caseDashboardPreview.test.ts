import {afterEach,expect,it,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {caseDashboardPreviewAvailable,caseDashboardPreviewMode} from "../caseDashboardPreview";
afterEach(()=>vi.unstubAllEnvs());
it("keeps the entry switch off by default, and only permits explicit loopback development",()=>{
  vi.stubEnv("NODE_ENV","development");vi.stubEnv("VERCEL_ENV",undefined);vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET",undefined);vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET",undefined);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","http://localhost:4193");vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED",undefined);
  expect(caseDashboardPreviewAvailable()).toBe(false);vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED","1");expect(caseDashboardPreviewAvailable()).toBe(true);
  vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED","read-only");expect(caseDashboardPreviewAvailable()).toBe(true);expect(caseDashboardPreviewMode()).toBe("read-only");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://lvnfspyainrxtztjytbo.supabase.co");expect(caseDashboardPreviewAvailable()).toBe(false);
  vi.stubEnv("NODE_ENV","production");vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","http://localhost:4193");expect(caseDashboardPreviewAvailable()).toBe(false);
});
it("does not turn a normal Vercel Preview or mismatched acceptance target into permission",()=>{
  vi.stubEnv("NATORI_CASE_DASHBOARD_PREVIEW_ENABLED","1");vi.stubEnv("NODE_ENV","development");vi.stubEnv("VERCEL_ENV","preview");
  vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET",undefined);vi.stubEnv("NEXT_PUBLIC_NATORI_CASE_ACCEPTANCE_TARGET",undefined);vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","http://localhost:4193");
  expect(caseDashboardPreviewAvailable()).toBe(false);vi.stubEnv("NATORI_CASE_ACCEPTANCE_TARGET","{}");expect(caseDashboardPreviewAvailable()).toBe(false);
});
