import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({ getMessages: vi.fn(async () => ({})) }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));

import LocaleLayout, { generateStaticParams } from '../layout';
import { getMessages } from 'next-intl/server';

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('locale generation across development and production', () => {
  it('avoids development prerender-manifest rewrites', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(generateStaticParams()).toEqual([]);
  });

  it('keeps both production locales for the build', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(generateStaticParams()).toEqual([{ locale: 'ja' }, { locale: 'en' }]);
  });

  it.each(['ja', 'en'])('still renders the supported %s locale on demand in development', async locale => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(await LocaleLayout({ children: null, params: Promise.resolve({ locale }) })).toBeTruthy();
    expect(getMessages).toHaveBeenCalledOnce();
  });

  it.each(['development', 'production'])('still rejects unsupported locales in %s', async mode => {
    vi.stubEnv('NODE_ENV', mode);
    await expect(LocaleLayout({ children: null, params: Promise.resolve({ locale: 'unknown' }) })).rejects.toThrow('NOT_FOUND');
    expect(getMessages).not.toHaveBeenCalled();
  });
});
