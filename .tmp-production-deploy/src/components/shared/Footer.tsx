import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/footer/terms', label: '利用規約' },
  { href: '/footer/privacy', label: 'プライバシーポリシー' },
  { href: '/footer/tokushoho', label: '特定商取引法に基づく表記' },
  { href: '/footer/copyright', label: '著作権・AI学習防止ポリシー' },
  { href: '/footer/disclaimer', label: '免責事項' },
  { href: '/footer/faq', label: 'よくある質問（FAQ）' },
  { href: '/admin-login', label: '管理者ログイン' },
] as const;

export default function Footer() {
  return (
    <footer className="mt-16 bg-gray-100 py-8">
      <div className="text-center text-sm text-gray-700">
        <p>© {new Date().getFullYear()} me-ish</p>
        <nav className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2 px-4">
          {FOOTER_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-gray-600 hover:text-[#00a1e9] transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}