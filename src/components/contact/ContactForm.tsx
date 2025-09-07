'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { sendEmail } from '@/app/_actions/sendEmail'; // 共通サーバーアクション

type Status = 'idle' | 'loading' | 'error';
type Category = 'general' | 'bug' | 'howto' | 'entry' | 'purchase' | 'other';

const CATEGORY_LABEL: Record<Category, string> = {
  general: '一般のお問い合わせ',
  bug: '不具合の報告',
  howto: '使い方について',
  entry: '出展について',
  purchase: '購入について',
  other: 'その他',
};

export default function ContactForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [status, setStatus] = useState<Status>('idle');
  const [category, setCategory] = useState<Category>('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState(''); // 任意
  const [message, setMessage] = useState('');

  // bug 用 追加項目（任意）
  const [pageUrl, setPageUrl] = useState('');
  const [device, setDevice] = useState('');
  const [browser, setBrowser] = useState('');
  const [steps, setSteps] = useState('');

  // 軽いスパム対策
  const [hp, setHp] = useState(''); // honeypot
  const [readyAt, setReadyAt] = useState<number>(0);
  useEffect(() => {
    setReadyAt(Date.now() + 1500); // 1.5秒未満の送信はbot扱い
  }, []);

  // ?type=bug などでカテゴリ初期値を上書き
  useEffect(() => {
    const t = (params.get('type') || '').toLowerCase();
    if (['general', 'bug', 'howto', 'entry', 'purchase', 'other'].includes(t)) {
      setCategory(t as Category);
    }
  }, [params]);

  // a11y IDs
  const catId = useId();
  const nameId = useId();
  const emailId = useId();
  const subjId = useId();
  const msgId = useId();
  const urlId = useId();
  const devId = useId();
  const brId = useId();
  const stepsId = useId();

  // バリデーション
  const emailRe = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const errors = {
    category: !category ? 'カテゴリは必須です' : '',
    name:
      !name.trim() ? 'お名前は必須です'
      : name.trim().length < 2 ? '2文字以上で入力してください'
      : '',
    email:
      !email.trim() ? 'メールアドレスは必須です'
      : !emailRe.test(email.trim()) ? '形式が正しくありません'
      : '',
    message:
      !message.trim() ? 'お問い合わせ内容は必須です'
      : message.trim().length < 10 ? '10文字以上で入力してください'
      : message.trim().length > 2000 ? '2000文字以内で入力してください'
      : '',
  };
  const isValid = !errors.category && !errors.name && !errors.email && !errors.message;

  // 本文整形（カテゴリ等を先頭にまとめる）
  const buildComposedMessage = () => {
    const headerLines = [
      `【カテゴリ】${CATEGORY_LABEL[category]}`,
      subject.trim() ? `【件名】${subject.trim()}` : '',
      category === 'bug' && pageUrl.trim() ? `【ページURL】${pageUrl.trim()}` : '',
      category === 'bug' && device.trim() ? `【端末/OS】${device.trim()}` : '',
      category === 'bug' && browser.trim() ? `【ブラウザ】${browser.trim()}` : '',
      category === 'bug' && steps.trim() ? `【再現手順】\n${steps.trim()}` : '',
    ].filter(Boolean).join('\n');

    return `${headerLines}\n\n【本文】\n${message.trim()}`;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // bot フィルタ
    if (hp || Date.now() < readyAt) return;
    if (!isValid || status === 'loading') return;

    setStatus('loading');

    try {
      const safeSubject = subject.trim() || `【${CATEGORY_LABEL[category]}】お問い合わせ`;
      const composed = buildComposedMessage();

      // 統合API: /api/send-email/contact（宛先はサーバー側で SUPPORT_EMAIL 固定）
      await sendEmail('contact', {
        name: name.trim(),
        email: email.trim(),        // Reply-To に使う
        subject: safeSubject,
        message: composed,
        category,
        pageUrl: pageUrl.trim() || undefined,
        device: device.trim() || undefined,
        browser: browser.trim() || undefined,
        steps: steps.trim() || undefined,
      });

      router.push('/contact/complete');
    } catch {
      setStatus('error');
    }
  };

  const placeholderByCat: Record<Category, string> = {
    general: 'ご用件をできるだけ具体的にご記入ください。',
    bug: '発生事象、エラー表示、発生タイミングなどをできるだけ詳しく。',
    howto: '困っている操作・目標・試したことなどを書いてください。',
    entry: '出展や応募に関するご質問・ご相談をお書きください。',
    purchase: '購入、決済、納品に関するご質問をお書きください。',
    other: 'その他のご用件をご自由にお書きください。',
  };

  // 触れたかどうかの管理（エラーメッセージ表示制御）
  const [touched, setTouched] = useState({ category: false, name: false, email: false, message: false });

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md mx-auto text-left space-y-5">
      {/* a11y: ステータス */}
      <div aria-live="polite" className="sr-only">
        {status === 'loading' ? '送信中です' : status === 'error' ? '送信に失敗しました' : ''}
      </div>

      {/* カテゴリ */}
      <div>
        <label htmlFor={catId} className="block mb-1 font-semibold">
          お問い合わせの種類 <span className="text-red-600">*</span>
        </label>
        <select
          id={catId}
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          onBlur={() => setTouched((t) => ({ ...t, category: true }))}
          aria-invalid={touched.category && !!errors.category}
          aria-describedby={touched.category && errors.category ? `${catId}-error` : undefined}
          className={`w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 ${
            touched.category && errors.category ? 'border-red-500' : 'border-gray-300'
          }`}
        >
          <option value="general">{CATEGORY_LABEL.general}</option>
          <option value="bug">{CATEGORY_LABEL.bug}</option>
          <option value="howto">{CATEGORY_LABEL.howto}</option>
          <option value="entry">{CATEGORY_LABEL.entry}</option>
          <option value="purchase">{CATEGORY_LABEL.purchase}</option>
          <option value="other">{CATEGORY_LABEL.other}</option>
        </select>
        {touched.category && errors.category && (
          <p id={`${catId}-error`} className="mt-1 text-sm text-red-600">{errors.category}</p>
        )}
      </div>

      {/* 件名（任意） */}
      <div>
        <label htmlFor={subjId} className="block mb-1 font-semibold">件名（任意）</label>
        <input
          id={subjId}
          type="text"
          inputMode="text"
          placeholder={`例: ${CATEGORY_LABEL[category]}について`}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 border-gray-300"
        />
      </div>

      {/* お名前 */}
      <div>
        <label htmlFor={nameId} className="block mb-1 font-semibold">
          お名前 <span className="text-red-600">*</span>
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          inputMode="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          aria-invalid={touched.name && !!errors.name}
          aria-describedby={touched.name && errors.name ? `${nameId}-error` : undefined}
          className={`w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 ${
            touched.name && errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {touched.name && errors.name && (
          <p id={`${nameId}-error`} className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* メール */}
      <div>
        <label htmlFor={emailId} className="block mb-1 font-semibold">
          メールアドレス <span className="text-red-600">*</span>
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          aria-invalid={touched.email && !!errors.email}
          aria-describedby={touched.email && errors.email ? `${emailId}-error` : undefined}
          className={`w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 ${
            touched.email && errors.email ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        {touched.email && errors.email && (
          <p id={`${emailId}-error`} className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      {/* bug の補助項目（任意） */}
      {category === 'bug' && (
        <div className="space-y-3 rounded-lg border p-3 bg-[#f8fbff]">
          <div>
            <label htmlFor={urlId} className="block mb-1 text-sm font-semibold">ページURL（任意）</label>
            <input
              id={urlId}
              type="url"
              inputMode="url"
              placeholder="例: https://www.me-ish.art/white"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              className="w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 border-gray-300"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={devId} className="block mb-1 text-sm font-semibold">端末/OS（任意）</label>
              <input
                id={devId}
                type="text"
                placeholder="例: iPhone 15 / iOS 17"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
                className="w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 border-gray-300"
              />
            </div>
            <div>
              <label htmlFor={brId} className="block mb-1 text-sm font-semibold">ブラウザ（任意）</label>
              <input
                id={brId}
                type="text"
                placeholder="例: Safari / Chrome 126"
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                className="w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 border-gray-300"
              />
            </div>
          </div>
          <div>
            <label htmlFor={stepsId} className="block mb-1 text-sm font-semibold">再現手順（任意）</label>
            <textarea
              id={stepsId}
              rows={3}
              placeholder={`例:\n1) White ギャラリーを開く\n2) 作品をタップ\n3) 画面が白くなる`}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              className="w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 border-gray-300"
            />
          </div>
        </div>
      )}

      {/* 本文 */}
      <div>
        <label htmlFor={msgId} className="block mb-1 font-semibold">
          お問い合わせ内容 <span className="text-red-600">*</span>
        </label>
        <textarea
          id={msgId}
          name="message"
          required
          rows={6}
          maxLength={2000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, message: true }))}
          aria-invalid={touched.message && !!errors.message}
          aria-describedby={`${msgId}-help${touched.message && errors.message ? ` ${msgId}-error` : ''}`}
          placeholder={placeholderByCat[category]}
          className={`w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 ${
            touched.message && errors.message ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500" id={`${msgId}-help`}>
          <span>できるだけ詳しくご記入ください。</span>
          <span>{message.length}/2000</span>
        </div>
        {touched.message && errors.message && (
          <p id={`${msgId}-error`} className="mt-1 text-sm text-red-600">{errors.message}</p>
        )}
      </div>

      {/* honeypot */}
      <div className="hidden" aria-hidden>
        <label htmlFor="website">あなたのWebサイト（空欄で送信）</label>
        <input
          id="website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={status === 'loading' || Date.now() < readyAt}
        className="inline-flex items-center gap-2 bg-[#00a1e9] text-white px-4 py-2 rounded hover:bg-[#008fcc] disabled:opacity-60"
      >
        {status === 'loading' ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            送信中…
          </>
        ) : (
          '送信'
        )}
      </button>

      {status === 'error' && (
        <p className="text-red-600 mt-2">送信に失敗しました。時間をおいて再度お試しください。</p>
      )}
    </form>
  );
}
