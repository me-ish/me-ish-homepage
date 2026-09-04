// e2e/auth.setup.ts
// Auth setup for authenticated E2E tests.
//
// Google OAuth のため通常の storageState パターンは使えない。
// 環境変数から Supabase セッショントークンを注入するひな形。
//
// === トークン生成手順 ===
// 1. ブラウザで手動ログイン
// 2. DevTools > Application > Local Storage > supabase.auth.token を取得
// 3. E2E_USER_TOKEN / E2E_ADMIN_TOKEN に設定
//
// === 使い方 ===
// E2E_USER_TOKEN=... npx playwright test --project=authenticated
// E2E_ADMIN_TOKEN=... npx playwright test --project=admin

import { test as setup } from "@playwright/test";
import path from "path";

const USER_STORAGE = path.join(__dirname, ".auth/user.json");
const ADMIN_STORAGE = path.join(__dirname, ".auth/admin.json");

setup("authenticate as user", async ({ page }) => {
  const token = process.env.E2E_USER_TOKEN;
  if (!token) {
    console.warn("[auth.setup] E2E_USER_TOKEN not set — skipping user auth setup");
    // Save empty state so dependent tests can be skipped gracefully
    await page.context().storageState({ path: USER_STORAGE });
    return;
  }

  await page.goto("/");

  // Inject Supabase session into localStorage
  // TODO: Adjust key/value format to match your Supabase client version
  await page.evaluate((t) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
    localStorage.setItem(storageKey, t);
  }, token);

  await page.reload();
  await page.context().storageState({ path: USER_STORAGE });
});

setup("authenticate as admin", async ({ page }) => {
  const token = process.env.E2E_ADMIN_TOKEN;
  if (!token) {
    console.warn("[auth.setup] E2E_ADMIN_TOKEN not set — skipping admin auth setup");
    await page.context().storageState({ path: ADMIN_STORAGE });
    return;
  }

  await page.goto("/");

  await page.evaluate((t) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
    localStorage.setItem(storageKey, t);
  }, token);

  await page.reload();
  await page.context().storageState({ path: ADMIN_STORAGE });
});
