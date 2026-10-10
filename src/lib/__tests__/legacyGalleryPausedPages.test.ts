import { describe, expect, it, vi } from 'vitest';

// Directly invoke the pages without middleware. Retired gallery entrypoints
// must redirect without even initializing an Auth/DB/Storage client.
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
vi.mock('@/lib/supabaseServer', () => { throw new Error('unexpected server DB import'); });
vi.mock('@/lib/supabaseClient', () => { throw new Error('unexpected browser DB import'); });
vi.mock('@/lib/supabase/client', () => { throw new Error('unexpected browser client import'); });

import MyPage from '@/app/[locale]/mypage/page';
import PortfolioSettingsPage from '@/app/[locale]/mypage/portfolio/page';
import RenewPage from '@/app/[locale]/renew/page';
import LinkExternalPage from '@/app/auth/link/page';

describe('retired gallery pages have no direct write path', () => {
  for (const [name, render] of [
    ['mypage', MyPage],
    ['portfolio settings', PortfolioSettingsPage],
    ['renew', RenewPage],
  ] as const) {
    it.each(['ja', 'en'])(`${name} redirects in %s without Auth or DB`, async (locale) => {
      await expect(render({ params: Promise.resolve({ locale }) }))
        .rejects.toThrow(`redirect:/${locale}/service-paused?service=gallery`);
    });
  }

  it('old ownership link redirects without reading or assigning an entry', () => {
    expect(() => LinkExternalPage()).toThrow('redirect:/ja/service-paused?service=gallery');
  });
});
