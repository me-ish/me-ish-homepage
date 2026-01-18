'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
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

  const [authLoading, setAuthLoading] = useState(true);
  const [me, setMe] = useState<HeaderUser | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);

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
    <header className="fixed top-0 left-0 z-[100] h-[70px] w-full bg-white/95 px-4 shadow backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <nav className="mx-auto flex h-full max-w-[1200px] items-center justify-between">
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
            className="ml-2 rounded-full bg-[#e60039] px-2 py-1 text-[11px] leading-none text-white transition hover:brightness-110"
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
              <Link
                href="/mypage"
                className="max-w-[320px] truncate rounded-full bg-[#f6f8fb] px-3 py-1.5 text-sm font-medium text-[#223] transition hover:bg-[#e7f2ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
                title={`ログイン中：${me.label}`}
                aria-label="マイページへ"
              >
                <span className="text-[#667]">ログイン中：</span>
                <span className="ml-1">{me.label}</span>
              </Link>

              <button
                type="button"
                onClick={logout}
                disabled={logoutBusy}
                aria-busy={logoutBusy}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#e11d48] px-3 py-1.5 text-sm text-[#e11d48] transition hover:bg-[#e11d48] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e11d48]/40',
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
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-[#00a1e9] px-3 py-1.5 text-sm text-[#00a1e9] transition hover:bg-[#00a1e9] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60 sm:text-base"
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
              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-full text-[#00a1e9] transition hover:bg-[#e8f7ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
            >
              <Menu className="h-6 w-6" />
            </button>

            <DialogContent
              hideCloseButton
              className={cn(
                'w-[92vw] max-w-[460px] overflow-hidden rounded-2xl border border-black/5 bg-white p-0 shadow-2xl'
              )}
            >
              <DialogHeader className="flex flex-row items-center justify-between border-b bg-white/90 px-5 py-4 backdrop-blur">
                <DialogTitle className="text-[1.05rem] font-semibold text-[#222]">
                  メニュー
                </DialogTitle>

                <DialogClose asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#f2f6fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
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
                      <div className="rounded-2xl border border-black/5 bg-[#f6f8fb] p-4">
                        <div className="mt-1 flex items-center justify-between gap-3">
<Link
  href="/mypage"
  onClick={() => setOpen(false)}
  className="min-w-0 flex-1 truncate rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#223] transition hover:bg-[#e7f2ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
  title={me.label}
>
  {me.label}
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
                              'inline-flex items-center justify-center rounded-xl border border-[#e11d48] px-3 py-2 text-sm font-medium text-[#e11d48] transition hover:bg-[#e11d48] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e11d48]/40',
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

                <div className="mt-6 border-t pt-4 text-center text-xs text-[#667]">
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
                  'block w-full rounded-xl px-4 py-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60',
                  active
                    ? 'bg-[#e7f2ff] text-[#0a5ea8]'
                    : 'bg-[#f6f8fb] text-[#222] hover:bg-[#e7f2ff]'
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
