// src/lib/__tests__/feeCalculation.test.ts
// Extended edge-case tests for fee/reward calculation
import { describe, it, expect } from "vitest";
import { calcFee, calcReward, FEE_RATE } from "../constants";

describe("calcFee edge cases", () => {
  it("fee is always non-negative", () => {
    for (let price = 0; price <= 100; price++) {
      expect(calcFee(price)).toBeGreaterThanOrEqual(0);
    }
  });

  it("fee for 0 is 0", () => {
    expect(calcFee(0)).toBe(0);
  });

  it("fee for 1 is 0 (floor)", () => {
    expect(calcFee(1)).toBe(0);
  });

  it("fee for 9 is 0 (floor of 0.9)", () => {
    expect(calcFee(9)).toBe(0);
  });

  it("fee for 10 is 1", () => {
    expect(calcFee(10)).toBe(1);
  });

  it("fee for 999 is 99 (floor)", () => {
    expect(calcFee(999)).toBe(99);
  });

  it("large value: fee for 1_000_000 is 100_000", () => {
    expect(calcFee(1_000_000)).toBe(100_000);
  });

  it("large value: fee for 999_999 is 99_999", () => {
    expect(calcFee(999_999)).toBe(99_999);
  });
});

describe("calcReward edge cases", () => {
  it("reward for 0 is 0", () => {
    expect(calcReward(0)).toBe(0);
  });

  it("reward for 1 is 1 (fee=0)", () => {
    expect(calcReward(1)).toBe(1);
  });

  it("reward for 10 is 9", () => {
    expect(calcReward(10)).toBe(9);
  });

  it("large value: reward for 1_000_000 is 900_000", () => {
    expect(calcReward(1_000_000)).toBe(900_000);
  });
});

describe("fee + reward invariant", () => {
  it("fee + reward === price for 0..10000", () => {
    for (let price = 0; price <= 10_000; price++) {
      const fee = calcFee(price);
      const reward = calcReward(price);
      expect(fee + reward).toBe(price);
    }
  });

  it("fee + reward === price for large values", () => {
    const prices = [50_000, 100_000, 500_000, 999_999, 1_000_000, 9_999_999];
    for (const price of prices) {
      expect(calcFee(price) + calcReward(price)).toBe(price);
    }
  });
});

describe("regression: old bug floor(price * 0.9)", () => {
  it("old formula diverges for price=999", () => {
    const price = 999;
    const oldReward = Math.floor(price * 0.9); // 899 (wrong)
    const oldFee = Math.floor(price * FEE_RATE); // 99
    // old: 899 + 99 = 998 !== 999
    expect(oldFee + oldReward).not.toBe(price);

    // new formula is correct
    expect(calcFee(price) + calcReward(price)).toBe(price);
  });

  it("old formula diverges for various prices", () => {
    // Find at least one price where old formula breaks
    let diverged = false;
    for (let p = 1; p <= 10_000; p++) {
      const oldReward = Math.floor(p * 0.9);
      const oldFee = Math.floor(p * FEE_RATE);
      if (oldFee + oldReward !== p) {
        diverged = true;
        // But new formula always holds
        expect(calcFee(p) + calcReward(p)).toBe(p);
        break;
      }
    }
    expect(diverged).toBe(true);
  });
});
