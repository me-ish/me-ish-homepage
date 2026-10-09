import { describe, expect, it } from 'vitest';
import { galleryLoginDestination } from '@/lib/galleryLoginDestination';

describe('retained gallery settlement login', () => {
  it('defaults to the locale-specific bank page while creation is paused', () => {
    expect(galleryLoginDestination(null, 'ja')).toBe('/settings/bank');
    expect(galleryLoginDestination(null, 'en')).toBe('/en/settings/bank');
  });

  it.each(['/settings/bank', '/ja/settings/bank', '/en/settings/bank?return=1'])('retains the supported internal destination %s', (path) => {
    expect(galleryLoginDestination(path, 'ja')).toBe(path);
  });

  it.each(['//evil.invalid', '/\\evil.invalid', 'https://evil.invalid', '/%2f%2fevil.invalid', '/mypage', '/aura/form', '/settings/bank/../../aura/form'])('rejects an external or suspended destination %s', (path) => {
    expect(galleryLoginDestination(path, 'ja')).toBe('/settings/bank');
  });
});
