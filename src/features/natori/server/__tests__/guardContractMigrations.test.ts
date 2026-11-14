// 案件の「守りの台帳」（natori_case_guard.dependencies）の登録もれを防ぐ。
//
// natori_case_guard.check_contract() は、公開スキーマの natori_ の表と関数すべてを台帳と照らし合わせる。
// 表・列・トリガー・関数を足したり変えたりしたのに台帳を更新しないと、見積の承諾・納品の受け取り・
// 相談ページの送信などの関数が natori_system_contract_changed で止まる（2026-11-05 の品目の表で実際に起きた）。
//
// ここでは SQL を実行せず、マイグレーションの文面だけを見る：
// 台帳ができたあとで表や関数を変えるマイグレーションは、同じファイルかそれより後のファイルで
// 台帳を更新していなければならない。
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(root, "supabase/baseline/manifest.json"), "utf8")) as {
  activeMigrations: string[];
};

/** 台帳（dependencies）を作ったマイグレーション。これより前は対象外。 */
const GUARD_INTRODUCED = "20261023010000_natori_case_system_hold.sql";

const CHANGES_SCHEMA =
  /\b(create\s+(or\s+replace\s+)?(table|function|trigger|policy|index|unique\s+index)\b|alter\s+table\b|alter\s+function\b|drop\s+(table|function|trigger)\b|grant\s|revoke\s)/iu;
const REFRESHES_LEDGER = /insert\s+into\s+natori_case_guard\.dependencies\b/iu;

describe("natori guard contract ledger", () => {
  it("is refreshed by (or after) the last migration that changes natori tables or functions", () => {
    const start = manifest.activeMigrations.findIndex((file) => file.endsWith(GUARD_INTRODUCED));
    expect(start).toBeGreaterThanOrEqual(0);
    let pending: string | null = null;
    for (const file of manifest.activeMigrations.slice(start)) {
      const sql = readFileSync(path.join(root, file), "utf8");
      if (CHANGES_SCHEMA.test(sql)) pending = file;
      if (REFRESHES_LEDGER.test(sql)) pending = null;
    }
    expect(
      pending,
      `${pending} が表や関数を変えていますが、natori_case_guard.dependencies を更新していません。` +
        "同じマイグレーションの最後で台帳を更新し、全 root の check_contract を通してください。",
    ).toBeNull();
  });
});
