import React, { useState, useEffect } from 'react';
import './MobileHome.css';

const MobileHome = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <div className="mobile-home">
      <header className="nav-header">
        <nav className="nav-inner">
          <div className="nav-logo">
            me-ish <span className="beta-badge">仮公開中</span>
          </div>
          <button className="menu-toggle" onClick={toggleMenu}>☰</button>
        </nav>
      </header>

      {menuOpen && <div className="nav-overlay" onClick={toggleMenu} />}
      {mounted && (
        <ul className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <button className="close-button" onClick={toggleMenu}>×</button>
          <li><a href="#about">me-ishとは</a></li>
            <li><a href="#gallery">ギャラリー</a></li>
            <li><a href="#apply">応募</a></li>
            <li><a href="#faq">FAQ</a></li>
            <li><a href="#contact">お問い合わせ</a></li>
        </ul>
      )}
            {/* Heroセクション */}
            <section className="hero fade-in">
        <h1 className="logo">me-ish</h1>
        <p className="subtitle">アートを、もっと近くに</p>
      </section>

      
      {/* Aboutセクション（追加） */}
      <section id="about" className="about fade-in">
        <div className="about-inner">
          <h2 className="section-title">me-ishとは</h2>
          <p>me-ish は、知名度やキャリアを問わず、すべてのアーティストが自由に作品を展示・販売できるオンラインギャラリーです。NFTと通常販売の両方に対応しており、アートをもっと身近に楽しめる場所を目指しています。
          </p>
        </div>
      </section>

      {/* ギャラリーセクション */}
      <section id="gallery" className="gallery-section fade-in">
        <h2>ギャラリーを見る</h2>
        <div className="gallery-grid">
        <a href="/white" className="gallery-card-link">
          <div className="gallery-card">
            <img src="/images/white-thumb.jpg" alt="White Gallery" />
            <h3>White Gallery</h3>
            <p>「意識の空間」をイメージした真っ白なギャラリー。10作品限定で構成された、me-ish初期の特別展示です。</p>
          </div>
        </a>
        <a href="/float" className="gallery-card-link">
          <div className="gallery-card">
            <img src="/images/float-thumb.jpg" alt="Float Gallery" />
            <h3>Float Gallery</h3>
            <p>「漂う」ように作品が入れ替わる、美術館風ギャラリー。テーマを設けず、日替わりで多彩な作品が展示されます。</p>
          </div>
        </a>
        </div>
      </section>

      {/* 応募セクション */}
      <section id="apply" className="apply-section fade-in">
        <h2>あなたのアートを、世界に届けよう。</h2>
        <p>me-ishでは、誰でも気軽に作品を展示できます。</p>
        <a href="/entry" className="apply-button">応募する</a>
      </section>

      {/* FAQセクション */}
      <section id="faq" className="faq-section fade-in">
        <h2>よくある質問</h2>
        <ul className="faq-list">
          <li>
            <strong>Q. 誰でも出展できますか？</strong>
            <p>A. はい、プロ・アマ問わずどなたでもご応募いただけます。</p>
          </li>
          <li>
            <strong>Q. 出展に料金はかかりますか？</strong>
            <p>A. β版の間は無料で展示できます。正式リリース後は手数料制を予定しています。</p>
          </li>
          <li>
            <strong>Q. NFTの販売は可能ですか？</strong>
            <p>A. はい、me-ishではNFT販売にも対応しており、円での購入も可能です。</p>
          </li>
        </ul>
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <a href="/faq" className="more-faq-button">よくある質問をもっと見る</a>
        </div>
      </section>

      {/* お問い合わせセクション */}
      <section id="contact" className="contact-section fade-in">
        <h2>お問い合わせ</h2>
        <p>ご質問やご相談は、以下のSNSまたはメールでご連絡ください。</p>
        <ul className="contact-links">
          <li><a href="mailto:info@me-ish.art">📧 info@me-ish.art</a></li>
          <li><a href="https://x.com/meishart0716" target="_blank" rel="noopener noreferrer">X（Twitter）</a></li>
        </ul>
      </section>

      {/* フッター */}
      <footer className="footer fade-in">
        <div className="footer-inner">
          <p>&copy; 2025 me-ish</p>
          <ul className="footer-links">
            <li><a href="/terms">利用規約</a></li>
            <li><a href="/privacy">プライバシーポリシー</a></li>
            <li><a href="/tokushoho">特定商取引法に基づく表記</a></li>
            <li><a href="/copyright">著作権・AI学習防止ポリシー</a></li>
            <li><a href="/disclaimer">免責事項</a></li>
            <li><a href="/faq">よくある質問（FAQ）</a></li>
            <li><a href="/admin-login">管理者ログイン</a></li>
          </ul>
        </div>
      </footer>
    </div>
  );
};

export default MobileHome;
