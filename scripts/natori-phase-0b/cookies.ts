// Integration-only Next request cookie adapter; Auth and SSR client remain real.
import { AsyncLocalStorage } from "node:async_hooks";
export const cookieScope = new AsyncLocalStorage<Map<string, string>>();
export async function cookies() {
  const jar = cookieScope.getStore();
  if (!jar) throw new Error("TEST_COOKIE_SCOPE_REQUIRED");
  return {
    get: (name: string) => jar.has(name) ? {name, value: jar.get(name)!} : undefined,
    getAll: () => [...jar].map(([name,value]) => ({name,value})),
    set: (name: string, value: string) => { jar.set(name,value); },
  };
}
