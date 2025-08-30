'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Status = 'idle' | 'loading' | 'error';

export default function ContactForm() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');

  // controlled inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState({ name: false, email: false, message: false });

  // 軽いスパム対策: 蜜壺(honeypot) + 最短送信時間
  const [hp, setHp] = useState(''); // ここが埋まってたら送信しない
  const [readyAt, setReadyAt] = useState<number>(0);
  useEffect(() => {
    setReadyAt(Date.now() + 1500); // ページ表示直後の超高速送信を抑制
  }, []);

  // IDs for a11y
  const nameId = useId();
  const emailId = useId();
  const msgId = useId();

  // validation
  const emailRe = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const errors = {
    name:
      !name.trim()
        ? 'お名前は必須です'
        : name.trim().length < 2
        ? '2文字以上で入力してください'
        : '',
    email:
      !email.trim()
        ? 'メールアドレスは必須です'
        : !emailRe.test(email.trim())
        ? '形式が正しくありません'
        : '',
    message:
      !message.trim()
        ? 'お問い合わせ内容は必須です'
        : message.trim().length < 10
        ? '10文字以上で入力してください'
        : message.trim().length > 2000
        ? '2000文字以内で入力してください'
        : '',
  };
  const isValid = !errors.name && !errors.email && !errors.message;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // bot: honeypot 検知 or 早すぎる送信
    if (hp || Date.now() < readyAt) return;

    setTouched({ name: true, email: true, message: true });
    if (!isValid || status === 'loading') return;

    setStatus('loading');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000); // 20s timeout

    try {
      const res = await fetch('/api/send-email/send-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (res.ok) {
        router.push('/contact/complete');
        return;
      }
      setStatus('error');
    } catch {
      clearTimeout(timer);
      setStatus('error');
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-md mx-auto text-left space-y-5">
      {/* a11y: ステータス表示 */}
      <div aria-live="polite" className="sr-only">
        {status === 'loading' ? '送信中です' : status === 'error' ? '送信に失敗しました' : ''}
      </div>

      {/* Name */}
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
          <p id={`${nameId}-error`} className="mt-1 text-sm text-red-600">
            {errors.name}
          </p>
        )}
      </div>

      {/* Email */}
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
          <p id={`${emailId}-error`} className="mt-1 text-sm text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      {/* Message */}
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
          aria-describedby={`${msgId}-help${
            touched.message && errors.message ? ` ${msgId}-error` : ''
          }`}
          className={`w-full border px-3 py-2 rounded outline-none focus:ring-2 focus:ring-[#00a1e9]/30 ${
            touched.message && errors.message ? 'border-red-500' : 'border-gray-300'
          }`}
        />
        <div className="mt-1 flex items-center justify-between text-xs text-gray-500" id={`${msgId}-help`}>
          <span>できるだけ詳しくご記入ください。</span>
          <span>{message.length}/2000</span>
        </div>
        {touched.message && errors.message && (
          <p id={`${msgId}-error`} className="mt-1 text-sm text-red-600">
            {errors.message}
          </p>
        )}
      </div>

      {/* honeypot: 表示しない/フォーカス不可（ボット用） */}
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
        disabled={status === 'loading'}
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
