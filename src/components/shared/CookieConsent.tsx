'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CONSENT_KEY = 'meish-cookie-consent';

type ConsentValue = 'accepted' | 'declined' | null;

// 言語別テキスト
const messages = {
  ja: {
    message: '当サイトでは、サービス向上のためCookieを使用しています。',
    learnMore: 'プライバシーポリシー',
    accept: '同意する',
    decline: '拒否',
  },
  en: {
    message: 'We use cookies to improve your experience.',
    learnMore: 'Privacy Policy',
    accept: 'Accept',
    decline: 'Decline',
  },
};

export default function CookieConsent() {
  const [consent, setConsent] = useState<ConsentValue>(null);
  const [visible, setVisible] = useState(false);
  const [locale, setLocale] = useState<'ja' | 'en'>('ja');

  useEffect(() => {
    // URLから言語を検出
    const path = window.location.pathname;
    if (path.startsWith('/en')) {
      setLocale('en');
    }

    const stored = localStorage.getItem(CONSENT_KEY) as ConsentValue;
    if (stored === 'accepted' || stored === 'declined') {
      setConsent(stored);
    } else {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setConsent('accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setConsent('declined');
    setVisible(false);
  };

  if (consent || !visible) return null;

  const t = messages[locale];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-300">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-gray-200 p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 text-sm text-gray-600 leading-relaxed">
            <p>
              {t.message}
              {' '}
              <Link
                href="/footer/privacy"
                className="text-[#00a1e9] hover:underline"
              >
                {t.learnMore}
              </Link>
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleDecline}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              {t.decline}
            </button>
            <button
              onClick={handleAccept}
              className="px-5 py-2 text-sm font-medium text-white bg-[#00a1e9] hover:bg-[#008ec4] rounded-lg transition"
            >
              {t.accept}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
