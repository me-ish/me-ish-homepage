'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const firstFocusRef = useRef<HTMLAnchorElement | null>(null);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (menuOpen) setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (last as HTMLElement).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          (first as HTMLElement).focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    setTimeout(() => firstFocusRef.current?.focus(), 0);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    const pathOnly = href.split('#')[0];
    return pathOnly === pathname;
  };

  const nav = {
    見る: [
      { label: 'White Gallery', href: '/white' },
      { label: 'Float Gallery', href: '/float' },
    ],
    知る: [
      { label: 'me-ishについて', href: '/modal/about' },
      { label: '出展ガイド', href: '/modal/creators' },
      { label: '購入ガイド', href: '/modal/buyers' },
      { label: 'プランと料金', href: '/modal/pricing' },
      { label: 'よくある質問', href: '/footer/faq' },
    ],
    連絡: [
      { label: 'お問い合わせ', href: '/#contact' },
      { label: 'お知らせ', href: '/news' },
    ],
  } as const;

  return (
    <header className="fixed top-0 left-0 w-full h-[70px] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow z-[100] px-4">
      <nav className="mx-auto max-w-[1200px] flex items-center justify-between h-full">
        {/* ロゴとバッジを兄弟要素に分離（Linkの入れ子を解消） */}
        <div className="flex items-center">
          <Link
            href="/"
            className="flex items-center text-[#00a1e9] font-lilita text-[1.8rem] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60 rounded-sm"
            aria-label="me-ish ホームへ"
          >
            me-ish
          </Link>
          <Link
            href="/news"
            className="ml-2 text-[11px] leading-none bg-[#e60039] text-white px-2 py-1 rounded-full hover:brightness-110 transition"
            aria-label="β公開中のお知らせを開く"
          >
            β公開中
          </Link>
        </div>

        {/* 右側：ログイン（PCのみ）＋メニュー */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center text-[#00a1e9] border border-[#00a1e9] px-3 py-1.5 rounded-full hover:bg-[#00a1e9] hover:text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60 text-sm sm:text-base whitespace-nowrap"
          >
            ログイン
          </Link>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
            aria-expanded={menuOpen}
            aria-controls="global-menu"
            className="inline-flex items-center justify-center w-[44px] h-[44px] rounded-full text-[#00a1e9] hover:bg-[#e8f7ff] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* モーダル（ポータル） */}
      {mounted &&
        createPortal(
          <>
            <div
              className={`fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
                menuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="global-menu-title"
              id="global-menu"
              className={`fixed left-1/2 top-1/2 z-[9999] w-[92vw] max-w-[460px] max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-black/5 bg-white shadow-2xl transition-all duration-200 ${
                menuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              }`}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 backdrop-blur px-5 py-4">
                <h2 id="global-menu-title" className="text-[1.05rem] font-semibold text-[#222]">
                  メニュー
                </h2>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-[#f2f6fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60"
                  aria-label="メニューを閉じる"
                >
                  <X className="w-5 h-5 text-[#556]" />
                </button>
              </div>

              <div className="px-5 py-5">
                <div className="mt-6 space-y-6">
                  <section aria-labelledby="sec-view">
                    <h3 id="sec-view" className="text-sm font-semibold text-[#667] mb-2 px-1">
                      見る
                    </h3>
                    <ul className="space-y-2">
                      {nav.見る.map(({ label, href }, i) => (
                        <li key={href}>
                          <Link
                            href={href}
                            // 初期フォーカス先（実装済みのロジックを活かす）
                            ref={i === 0 ? firstFocusRef : undefined}
                            onClick={() => setMenuOpen(false)}
                            className={`block w-full rounded-xl px-4 py-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60 ${
                              isActive(href)
                                ? 'bg-[#e7f2ff] text-[#0a5ea8]'
                                : 'bg-[#f6f8fb] hover:bg-[#e7f2ff] text-[#222]'
                            }`}
                            aria-current={isActive(href) ? 'page' : undefined}
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section aria-labelledby="sec-learn">
                    <h3 id="sec-learn" className="text-sm font-semibold text-[#667] mb-2 px-1">
                      知る
                    </h3>
                    <ul className="space-y-2">
                      {nav.知る.map(({ label, href }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={() => setMenuOpen(false)}
                            className={`block w-full rounded-xl px-4 py-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60 ${
                              isActive(href)
                                ? 'bg-[#e7f2ff] text-[#0a5ea8]'
                                : 'bg-[#f6f8fb] hover:bg-[#e7f2ff] text-[#222]'
                            }`}
                            aria-current={isActive(href) ? 'page' : undefined}
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section aria-labelledby="sec-contact">
                    <h3 id="sec-contact" className="text-sm font-semibold text-[#667] mb-2 px-1">
                      連絡
                    </h3>
                    <ul className="space-y-2">
                      {nav.連絡.map(({ label, href }) => (
                        <li key={href}>
                          <Link
                            href={href}
                            onClick={() => setMenuOpen(false)}
                            className={`block w-full rounded-xl px-4 py-3 font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00a1e9]/60 ${
                              isActive(href)
                                ? 'bg-[#e7f2ff] text-[#0a5ea8]'
                                : 'bg-[#f6f8fb] hover:bg-[#e7f2ff] text-[#222]'
                            }`}
                            aria-current={isActive(href) ? 'page' : undefined}
                          >
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>

                <div className="mt-6 border-t pt-4 text-center text-xs text-[#667]">
                  © {new Date().getFullYear()} me-ish
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </header>
  );
}
