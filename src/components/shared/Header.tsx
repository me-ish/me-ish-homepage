'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';

// shadcn/ui
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

type NavItem = { label: string; href: string };

type HeaderUser = {
  id: string;
  email: string | null;
  label: string; // 表示名（表示用）
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [me, setMe] = useState<HeaderUser | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

  // スクロール検知
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ルート遷移したら閉じる（LinkクリックでもOK、ブラウザ戻るでもOK）
  useEffect(() => {
    if (open) setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const nav = useMemo(
    () =>
      ({
        見る: [
          { label: 'White Gallery', href: '/white' },
          { label: 'Float Gallery', href: '/float' },
        ],
        知る: [
          { label: 'me-ishについて', href: '/modal/about' },
          { label: 'AURAとは（ポートフォリオ）', href: '/aura' },
          { label: 'ポートフォリオを作成', href: '/aura/form' },
          { label: '出展ガイド', href: '/modal/creators' },
          { label: '購入ガイド', href: '/modal/buyers' },
          { label: 'プランと料金', href: '/modal/pricing' },
          { label: 'よくある質問', href: '/footer/faq' },
        ],
        連絡: [
          { label: 'お問い合わせ', href: '/contact' },
          { label: 'お知らせ', href: '/news' },
        ],
      }) as const,
    []
  );

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    const pathOnly = href.split('#')[0];
    return pathOnly === pathname;
  };

  const loadMe = useCallback(async () => {
    try {
      setAuthLoading(true);

      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setMe(null);
        return;
      }

      const user = data.user;
      let label: string | null = null;

      // profiles.display_name を優先
      const { data: prof } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();

      label =
        (prof as any)?.display_name?.trim?.() ||
        (user.user_metadata as any)?.full_name?.trim?.() ||
        (user.user_metadata as any)?.name?.trim?.() ||
        user.email ||
        null;

      setMe({
        id: user.id,
        email: user.email ?? null,
        label: label ?? 'Account',
      });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    // 初期ロード
    loadMe();

    // ログイン/ログアウトに即追従
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadMe();
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, [loadMe]);

  const logout = useCallback(async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await supabase.auth.signOut();
      setMe(null);

      // 画面上の状態を更新（サーバーコンポーネント混在でも整合が取りやすい）
      router.refresh();

      // ログイン必須ページに居る場合に備えて / へ戻す（任意だが事故が減る）
      if (pathname?.startsWith('/mypage') || pathname?.startsWith('/admin')) {
        router.replace('/');
      }
    } finally {
      setLogoutBusy(false);
    }
  }, [logoutBusy, pathname, router]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 z-40 h-[70px] w-full px-2 sm:px-4 transition-all duration-300',
        scrolled
          ? 'bg-white/95 shadow-md backdrop-blur-md ring-1 ring-black/5'
          : 'bg-white/70 shadow-sm backdrop-blur-md ring-1 ring-black/[0.03]'
      )}
    >
      <nav className="mx-auto flex h-full w-full items-center justify-between md:max-w-[1440px]">
        {/* ロゴ / バッジ */}
        <div className="flex items-center">
          <Link
            href="/"
            className="rounded-sm font-lilita text-[1.8rem] font-bold text-[#00a1e9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
            aria-label="me-ish ホームへ"
          >
            me-ish
          </Link>

          <Link
            href="/news"
            className="ml-2 rounded-full bg-[#e60039] px-2 py-1 text-[11px] leading-none text-white transition-all duration-300 hover:brightness-125 hover:shadow-[0_0_12px_rgba(230,0,57,0.4)]"
            aria-label="β公開中のお知らせを開く"
          >
            β公開中
          </Link>
        </div>

        {/* 右側：アカウント表示 + ログアウト or ログイン + メニュー */}
        <div className="flex items-center gap-3">
          {/* Auth UI */}
{!authLoading && me ? (
  <div className="hidden items-center gap-2 sm:flex">
    {/* ✅ 明示導線：マイページへ */}
    <Link
      href="/mypage"
      className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-gradient-to-r from-[#00a1e9] to-[#0080c0] px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-300 hover:from-[#0090d4] hover:to-[#0070a8] hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
      aria-label="マイページへ"
      title="マイページへ"
    >
      <UserRound className="mr-2 h-4 w-4" />
      マイページへ
    </Link>

    {/* ✅ ログイン中の表示名は"情報"として表示（リンクにしない） */}
    <span
      className="max-w-[220px] truncate rounded-full bg-gradient-to-r from-[#f6f8fb] to-[#f0f4f8] px-3 py-1.5 text-sm font-medium text-[#223] ring-1 ring-black/5"
      title={`ログイン中：${me.label}`}
      aria-label={`ログイン中：${me.label}`}
    >
      <span className="text-[#667]">ログイン中：</span>
      <span className="ml-1">{me.label}</span>
    </span>

    <button
      type="button"
      onClick={logout}
      disabled={logoutBusy}
      aria-busy={logoutBusy}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#e11d48] px-3 py-1.5 text-sm text-[#e11d48] transition-all duration-300 hover:bg-[#e11d48] hover:text-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e11d48]/40',
        logoutBusy && 'cursor-not-allowed opacity-70'
      )}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {logoutBusy ? 'ログアウト中…' : 'ログアウト'}
    </button>
  </div>
) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#00a1e9] px-3 py-1.5 text-sm text-[#00a1e9] transition-all duration-300 hover:bg-[#00a1e9] hover:text-white hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60 sm:text-base"
            >
              ログイン
            </Link>
          )}

          <Dialog open={open} onOpenChange={setOpen}>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="メニューを開く"
              aria-haspopup="dialog"
              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-full text-[#00a1e9] transition-all duration-300 hover:bg-[#e8f7ff] hover:shadow-md hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
            >
              <Menu className="h-6 w-6" />
            </button>

<DialogContent
  hideCloseButton
  className={cn(
    'w-[92vw] max-w-[460px] overflow-hidden rounded-2xl bg-white/95 backdrop-blur-lg ring-1 ring-white/40 border border-white/30 p-0 shadow-2xl',
    'sm:top-1/2 sm:-translate-y-1/2',
    'max-sm:top-[calc(env(safe-area-inset-top)+12px)] max-sm:-translate-y-0'
  )}
>

              <DialogHeader className="flex flex-row items-center justify-between border-b border-black/5 bg-white/80 px-5 py-4 backdrop-blur-sm">
                <DialogTitle className="text-[1.05rem] font-semibold text-[#222]">
                  メニュー
                </DialogTitle>

                <DialogClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 hover:bg-[#e8f7ff] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
                    aria-label="メニューを閉じる"
                  >
                    <X className="h-5 w-5 text-[#556]" />
                  </button>
                </DialogClose>
              </DialogHeader>

              {/* 内容 */}
              <div className="max-h-[78vh] overflow-y-auto px-5 py-5">
                {/* SP内：アカウント欄（ログイン時のみ） */}
                {!authLoading && me && (
                  <>
                    <section aria-label="アカウント" className="mb-4">
                      <div className="rounded-2xl bg-gradient-to-br from-[#f6f8fb] to-white ring-1 ring-black/5 p-4">
                        <div className="mt-1 flex items-center justify-between gap-3">
<Link
  href="/mypage"
  onClick={() => setOpen(false)}
  className="min-w-0 flex-1 rounded-xl bg-gradient-to-r from-[#00a1e9]/10 to-[#0080c0]/10 px-3 py-2 text-sm font-semibold text-[#223] ring-1 ring-[#00a1e9]/20 transition-all duration-300 hover:from-[#00a1e9]/20 hover:to-[#0080c0]/20 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
  aria-label="マイページへ"
  title="マイページへ"
>
  <div className="flex items-center gap-2">
    <UserRound className="h-4 w-4 text-[#00a1e9]" />
    <span>マイページへ</span>
  </div>
  <div className="mt-1 truncate text-xs font-medium text-[#667]" title={`ログイン中：${me.label}`}>
    ログイン中：{me.label}
  </div>
</Link>

                          <button
                            type="button"
                            onClick={async () => {
                              // メニューを閉じてからログアウト
                              setOpen(false);
                              await logout();
                            }}
                            disabled={logoutBusy}
                            aria-busy={logoutBusy}
                            className={cn(
                              'inline-flex items-center justify-center rounded-xl border border-[#e11d48] px-3 py-2 text-sm font-medium text-[#e11d48] transition-all duration-300 hover:bg-[#e11d48] hover:text-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e11d48]/40',
                              logoutBusy && 'cursor-not-allowed opacity-70'
                            )}
                          >
                            <LogOut className="mr-2 h-4 w-4" />
                            {logoutBusy ? '…' : 'ログアウト'}
                          </button>
                        </div>
                      </div>
                    </section>

                    <Divider />
                  </>
                )}

                <MenuSection
                  title="見る"
                  items={nav.見る}
                  isActive={isActive}
                  onSelect={() => setOpen(false)}
                  firstFocus
                />

                <Divider />

                <MenuSection
                  title="知る"
                  items={nav.知る}
                  isActive={isActive}
                  onSelect={() => setOpen(false)}
                />

                <Divider />

                <MenuSection
                  title="連絡"
                  items={nav.連絡}
                  isActive={isActive}
                  onSelect={() => setOpen(false)}
                />

                <div className="mt-6 border-t border-black/5 pt-4 text-center text-xs text-[#667]">
                  © {new Date().getFullYear()} me-ish
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </nav>
    </header>
  );
}

function Divider() {
  return <div className="my-5 h-px w-full bg-black/5" />;
}

function MenuSection({
  title,
  items,
  isActive,
  onSelect,
  firstFocus = false,
}: {
  title: string;
  items: readonly NavItem[];
  isActive: (href: string) => boolean;
  onSelect: () => void;
  firstFocus?: boolean;
}) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 px-1 text-sm font-semibold text-[#667]">{title}</h3>
      <ul className="space-y-2">
        {items.map(({ label, href }, i) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onSelect}
                autoFocus={firstFocus && i === 0}
                className={cn(
                  'block w-full rounded-xl px-4 py-3 font-medium transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60',
                  active
                    ? 'bg-[#e7f2ff] text-[#0a5ea8]'
                    : 'bg-[#f6f8fb] text-[#222] hover:bg-[#e7f2ff] hover:translate-x-1'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
