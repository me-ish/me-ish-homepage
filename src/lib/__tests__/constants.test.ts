import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  calcFee,
  calcReward,
  getSiteUrl,
  getEmailLinks,
  AVATAR_MAX_BYTES,
  WORKS_IMAGE_MAX_BYTES,
  ALLOWED_IMAGE_MIMES,
  FEE_RATE,
} from '../constants';

// ============================================================
// calcFee / calcReward
// ============================================================

describe('calcFee', () => {
  it('100 → 10', () => expect(calcFee(100)).toBe(10));
  it('999 → 99 (floor)', () => expect(calcFee(999)).toBe(99));
  it('1 → 0 (floor)', () => expect(calcFee(1)).toBe(0));
  it('0 → 0', () => expect(calcFee(0)).toBe(0));
  it('1500 → 150', () => expect(calcFee(1500)).toBe(150));
});

describe('calcReward', () => {
  it('fee + reward = price (100)', () => {
    const price = 100;
    expect(calcFee(price) + calcReward(price)).toBe(price);
  });

  it('fee + reward = price (999)', () => {
    const price = 999;
    expect(calcFee(price) + calcReward(price)).toBe(price);
  });

  it('fee + reward = price (1)', () => {
    const price = 1;
    expect(calcFee(price) + calcReward(price)).toBe(price);
  });

  it('fee + reward = price for many values', () => {
    for (let price = 0; price <= 2000; price++) {
      expect(calcFee(price) + calcReward(price)).toBe(price);
    }
  });
});

// ============================================================
// getSiteUrl
// ============================================================

describe('getSiteUrl', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('prefers NEXT_PUBLIC_SITE_URL', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com';
    process.env.VERCEL_URL = 'vercel-preview.app';
    expect(getSiteUrl()).toBe('https://example.com');
  });

  it('falls back to VERCEL_URL with https prefix', () => {
    process.env.VERCEL_URL = 'my-app.vercel.app';
    expect(getSiteUrl()).toBe('https://my-app.vercel.app');
  });

  it('falls back to localhost when no env vars', () => {
    expect(getSiteUrl()).toBe('http://localhost:3000');
  });
});

// ============================================================
// getEmailLinks
// ============================================================

describe('getEmailLinks', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://me-ish.art';
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('builds correct URLs', () => {
    const links = getEmailLinks();
    expect(links.siteUrl).toBe('https://me-ish.art');
    expect(links.faqUrl).toBe('https://me-ish.art/faq');
    expect(links.termsUrl).toBe('https://me-ish.art/footer/terms');
    expect(links.mypageUrl).toBe('https://me-ish.art/mypage');
    expect(links.adminPayoutsUrl).toBe('https://me-ish.art/admin/payouts');
    expect(links.renewUrl).toBe('https://me-ish.art/renew');
  });
});

// ============================================================
// Constants
// ============================================================

describe('constants', () => {
  it('AVATAR_MAX_BYTES is 2MB', () => {
    expect(AVATAR_MAX_BYTES).toBe(2 * 1024 * 1024);
  });

  it('WORKS_IMAGE_MAX_BYTES is 8MB', () => {
    expect(WORKS_IMAGE_MAX_BYTES).toBe(8 * 1024 * 1024);
  });

  it('ALLOWED_IMAGE_MIMES contains expected types', () => {
    expect(ALLOWED_IMAGE_MIMES.has('image/jpeg')).toBe(true);
    expect(ALLOWED_IMAGE_MIMES.has('image/png')).toBe(true);
    expect(ALLOWED_IMAGE_MIMES.has('image/webp')).toBe(true);
    expect(ALLOWED_IMAGE_MIMES.has('image/gif')).toBe(true);
    expect(ALLOWED_IMAGE_MIMES.has('image/bmp')).toBe(false);
  });

  it('FEE_RATE is 0.1', () => {
    expect(FEE_RATE).toBe(0.1);
  });
});
