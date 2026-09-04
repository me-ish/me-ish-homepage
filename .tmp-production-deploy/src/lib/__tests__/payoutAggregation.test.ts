// src/lib/__tests__/payoutAggregation.test.ts
// Payout aggregation logic tests
import { describe, it, expect } from "vitest";

// Reproduce the aggregation pattern used in admin payout routes
function aggregatePayouts(
  sales: { artist_reward_yen: number | null }[]
): number {
  return sales.reduce(
    (sum, s) => sum + (s.artist_reward_yen ?? 0),
    0
  );
}

describe("payout aggregation", () => {
  it("sums artist_reward_yen correctly", () => {
    const sales = [
      { artist_reward_yen: 900 },
      { artist_reward_yen: 450 },
      { artist_reward_yen: 1350 },
    ];
    expect(aggregatePayouts(sales)).toBe(2700);
  });

  it("handles null values gracefully", () => {
    const sales = [
      { artist_reward_yen: 900 },
      { artist_reward_yen: null },
      { artist_reward_yen: 450 },
    ];
    expect(aggregatePayouts(sales)).toBe(1350);
  });

  it("returns 0 for empty array", () => {
    expect(aggregatePayouts([])).toBe(0);
  });

  it("handles single sale", () => {
    expect(aggregatePayouts([{ artist_reward_yen: 5000 }])).toBe(5000);
  });

  it("handles all null values", () => {
    const sales = [
      { artist_reward_yen: null },
      { artist_reward_yen: null },
    ];
    expect(aggregatePayouts(sales)).toBe(0);
  });
});
