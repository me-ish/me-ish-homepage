  'use client';

  import { useState, useEffect } from 'react';
  import { createPortal } from 'react-dom';

  export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []); 

    const navItems = [
      { label: 'me-ishとは', href: '/about' },
      { label: 'ギャラリーを見る', href: '#gallery' },
      { label: '出展をご希望の方へ', href: '/creators' },
      { label: 'ギャラリーへの参加・購入方法', href: '/buyers' },
      { label: '料金プラン', href: '/pricing' },
      { label: 'よくある質問', href: '/faq' },
      { label: 'ブログ', href: '/blog' },
      { label: 'お問い合わせ', href: '#contact' },
    ];

    return (
      <header className="fixed top-0 left-0 w-full h-[70px] bg-white shadow z-[100] px-4">
<nav className="flex items-center justify-between h-full">
  {/* ロゴ */}
  <div className="flex items-center text-[#00a1e9] font-lilita text-[1.8rem] font-bold">
    me-ish
    <span className="ml-2 text-xs bg-[#e60039] text-white px-2 py-0.5 rounded">
      仮公開中
    </span>
  </div>

  {/* ログインボタン＋メニュー */}
  <div className="flex items-center space-x-4">
    {/* 新規登録・ログイン */}
    <a
      href="/login"
      className="text-[#00a1e9] border border-[#00a1e9] px-3 py-1.5 rounded hover:bg-[#00a1e9] hover:text-white transition"
    >
      ログイン
    </a>

    {/* メニューボタン（☰ / ×） */}
    <button
      onClick={() => setMenuOpen(!menuOpen)}
      aria-label={menuOpen ? 'メニューを閉じる' : 'メニューを開く'}
      className="w-[60px] h-[40px] flex items-center justify-center z-[110]"
    >
      <span
        className={`text-[2.5rem] text-[#00a1e9] transition-all duration-300 transform ${
          menuOpen ? 'opacity-0 scale-90 absolute' : 'opacity-100 scale-100'
        }`}
      >
        ☰
      </span>
      <span
        className={`text-[2.5rem] text-[#00a1e9] transition-all duration-300 transform absolute ${
          menuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        ×
      </span>
    </button>
  </div>
</nav>


        {/* モーダルメニュー & 背景（ポータル描画） */}
        {mounted &&
          createPortal(
            <>
              {/* オーバーレイ背景 */}
              {menuOpen && (
                <div
                  className="fixed inset-0 bg-black bg-opacity-60 z-[9998]"
                  onClick={() => setMenuOpen(false)}
                  aria-label="メニュー背景クリックで閉じる"
                />
              )}

              {/* モーダルメニュー本体 */}
<aside
  className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
    bg-white w-[90vw] max-w-[400px] max-h-[90vh] overflow-y-auto
    z-[9999] p-6 rounded-xl shadow-xl transition-all duration-300 ${
      menuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
    }`}
>
  {/* 閉じるボタン */}
  <button
    onClick={() => setMenuOpen(false)}
    className="absolute top-4 right-4 text-[1.5rem] text-gray-500 hover:text-gray-800"
    aria-label="メニューを閉じる"
  >
    ×
  </button>

  <ul className="flex flex-col space-y-4 text-center mt-4">
    {navItems.map(({ label, href }) => (
      <li key={href}>
        <a
          href={href}
          onClick={() => setMenuOpen(false)}
          className="block bg-[#f6f8fb] hover:bg-[#e0efff] text-[#333] font-bold py-3 px-4 rounded-lg transition"
        >
          {label}
        </a>
      </li>
    ))}
  </ul>
</aside>

            </>,
            document.body
          )}
      </header>
    );
  }