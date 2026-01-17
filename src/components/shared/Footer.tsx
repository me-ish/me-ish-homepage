'use client';

import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="footer fade-in" style={{ backgroundColor: '#f3f3f3', padding: '2rem 0', marginTop: '4rem' }}>
      <div className="footer-inner" style={{ textAlign: 'center', fontSize: '0.9rem', color: '#333' }}>
        <p>© 2025 me-ish</p>
        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1.5rem' }}>
          <Link href="/footer/terms">利用規約</Link>
          <Link href="/footer/privacy">プライバシーポリシー</Link>
          <Link href="/footer/tokushoho">特定商取引法に基づく表記</Link>
          <Link href="/footer/copyright">著作権・AI学習防止ポリシー</Link>
          <Link href="/footer/disclaimer">免責事項</Link>
          <Link href="/footer/faq">よくある質問（FAQ）</Link>
          <Link href="/admin-login">管理者ログイン</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;