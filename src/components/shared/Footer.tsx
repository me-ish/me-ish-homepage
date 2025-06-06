'use client';

import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="footer fade-in" style={{ backgroundColor: '#f3f3f3', padding: '2rem 0', marginTop: '4rem' }}>
      <div className="footer-inner" style={{ textAlign: 'center', fontSize: '0.9rem', color: '#333' }}>
        <p>© 2025 me-ish</p>
        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem' }}>
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/tokushoho">特定商取引法に基づく表記</Link>
          <Link href="/copyright">著作権・AI学習防止ポリシー</Link>
          <Link href="/disclaimer">免責事項</Link>
          <Link href="/faq">よくある質問（FAQ）</Link>
          <Link href="/admin-login">管理者ログイン</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;