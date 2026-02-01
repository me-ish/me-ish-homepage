'use client';

import {useEffect,useId,useMemo,useState,type ElementType,type FormEvent,} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Send, AlertCircle, CheckCircle2, Bug, HelpCircle, Palette, ShoppingCart, MessageSquare } from 'lucide-react';
import { sendEmail } from '@/app/_actions/sendEmail';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'loading' | 'error';
type Category = 'general' | 'bug' | 'howto' | 'entry' | 'purchase' | 'other';

const CATEGORY_OPTIONS: {
  value: Category;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'general', label: '一般のお問い合わせ', icon: MessageSquare },
  { value: 'bug', label: '不具合の報告', icon: Bug },
  { value: 'howto', label: '使い方について', icon: HelpCircle },
  { value: 'entry', label: '出展について', icon: Palette },
  { value: 'purchase', label: '購入について', icon: ShoppingCart },
  { value: 'other', label: 'その他', icon: MessageSquare },
];

const CATEGORY_LABEL: Record<Category, string> = {
  general: '一般のお問い合わせ',
  bug: '不具合の報告',
  howto: '使い方について',
  entry: '出展について',
  purchase: '購入について',
  other: 'その他',
};

// 共通の入力フィールドスタイル
const INPUT_BASE = cn(
  'w-full border px-4 py-3 rounded-xl outline-none',
  'bg-white/80 backdrop-blur-sm',
  'transition-all duration-300',
  'focus:ring-2 focus:ring-[#00a1e9]/30 focus:border-[#00a1e9]',
  'placeholder:text-gray-400'
);

const INPUT_ERROR = 'border-red-400 focus:ring-red-200 focus:border-red-400';
const INPUT_NORMAL = 'border-gray-200 hover:border-gray-300';

export default function ContactForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [status, setStatus] = useState<Status>('idle');
  const [category, setCategory] = useState<Category>('general');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // bug 用 追加項目（任意）
  const [pageUrl, setPageUrl] = useState('');
  const [device, setDevice] = useState('');
  const [browser, setBrowser] = useState('');
  const [steps, setSteps] = useState('');

  // 軽いスパム対策
  const [hp, setHp] = useState('');
  const [readyAt, setReadyAt] = useState<number>(0);
  useEffect(() => {
    setReadyAt(Date.now() + 1500);
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

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // bot フィルタ
    if (hp || Date.now() < readyAt) return;
    if (!isValid || status === 'loading') return;

    setStatus('loading');

    try {
      const safeSubject = subject.trim() || `【${CATEGORY_LABEL[category]}】お問い合わせ`;
      const composed = buildComposedMessage();

      await sendEmail('contact', {
        name: name.trim(),
        email: email.trim(),
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

  const [touched, setTouched] = useState({ category: false, name: false, email: false, message: false });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="max-w-lg mx-auto text-left space-y-6"
    >
      {/* a11y: ステータス */}
      <div aria-live="polite" className="sr-only">
        {status === 'loading' ? '送信中です' : status === 'error' ? '送信に失敗しました' : ''}
      </div>

      {/* フォームカード */}
      <div className="rounded-2xl bg-white/80 backdrop-blur-sm ring-1 ring-[#00a1e9]/10 border border-white/60 shadow-sm p-6 md:p-8 space-y-6">
        {/* カテゴリ選択（カード型） */}
        <div>
          <label htmlFor={catId} className="block mb-3 font-semibold text-[#023]">
            お問い合わせの種類 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {CATEGORY_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-300',
                  'text-sm font-medium',
                  category === value
                    ? 'bg-[#00a1e9]/10 border-[#00a1e9] text-[#00a1e9] ring-2 ring-[#00a1e9]/20'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#00a1e9]/50 hover:bg-[#f0f9ff]'
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
          {/* 隠しselect（a11y用） */}
          <select
            id={catId}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="sr-only"
            aria-label="お問い合わせの種類"
          >
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* 件名（任意） */}
        <div>
          <label htmlFor={subjId} className="block mb-2 font-semibold text-[#023]">
            件名<span className="text-gray-400 font-normal ml-1">（任意）</span>
          </label>
          <input
            id={subjId}
            type="text"
            inputMode="text"
            placeholder={`例: ${CATEGORY_LABEL[category]}`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={cn(INPUT_BASE, INPUT_NORMAL)}
          />
        </div>

        {/* お名前 */}
        <div>
          <label htmlFor={nameId} className="block mb-2 font-semibold text-[#023]">
            お名前 <span className="text-red-500">*</span>
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
            className={cn(INPUT_BASE, touched.name && errors.name ? INPUT_ERROR : INPUT_NORMAL)}
          />
          {touched.name && errors.name && (
            <p id={`${nameId}-error`} className="mt-2 text-sm text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4" />
              {errors.name}
            </p>
          )}
        </div>

        {/* メール */}
        <div>
          <label htmlFor={emailId} className="block mb-2 font-semibold text-[#023]">
            メールアドレス <span className="text-red-500">*</span>
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
            className={cn(INPUT_BASE, touched.email && errors.email ? INPUT_ERROR : INPUT_NORMAL)}
          />
          {touched.email && errors.email && (
            <p id={`${emailId}-error`} className="mt-2 text-sm text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4" />
              {errors.email}
            </p>
          )}
        </div>

        {/* bug の補助項目（任意） */}
        {category === 'bug' && (
          <div className="space-y-4 rounded-xl p-4 bg-gradient-to-br from-[#f8fbff] to-white ring-1 ring-[#00a1e9]/10 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 text-[#00a1e9] font-medium text-sm">
              <Bug className="w-4 h-4" />
              不具合の詳細（任意）
            </div>
            <div>
              <label htmlFor={urlId} className="block mb-2 text-sm font-medium text-[#445]">
                ページURL
              </label>
              <input
                id={urlId}
                type="url"
                inputMode="url"
                placeholder="例: https://www.me-ish.art/white"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                className={cn(INPUT_BASE, INPUT_NORMAL, 'text-sm')}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={devId} className="block mb-2 text-sm font-medium text-[#445]">
                  端末/OS
                </label>
                <input
                  id={devId}
                  type="text"
                  placeholder="例: iPhone 15 / iOS 17"
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  className={cn(INPUT_BASE, INPUT_NORMAL, 'text-sm')}
                />
              </div>
              <div>
                <label htmlFor={brId} className="block mb-2 text-sm font-medium text-[#445]">
                  ブラウザ
                </label>
                <input
                  id={brId}
                  type="text"
                  placeholder="例: Safari / Chrome 126"
                  value={browser}
                  onChange={(e) => setBrowser(e.target.value)}
                  className={cn(INPUT_BASE, INPUT_NORMAL, 'text-sm')}
                />
              </div>
            </div>
            <div>
              <label htmlFor={stepsId} className="block mb-2 text-sm font-medium text-[#445]">
                再現手順
              </label>
              <textarea
                id={stepsId}
                rows={3}
                placeholder={`例:\n1) White ギャラリーを開く\n2) 作品をタップ\n3) 画面が白くなる`}
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className={cn(INPUT_BASE, INPUT_NORMAL, 'text-sm resize-none')}
              />
            </div>
          </div>
        )}

        {/* 本文 */}
        <div>
          <label htmlFor={msgId} className="block mb-2 font-semibold text-[#023]">
            お問い合わせ内容 <span className="text-red-500">*</span>
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
            className={cn(
              INPUT_BASE,
              'resize-none',
              touched.message && errors.message ? INPUT_ERROR : INPUT_NORMAL
            )}
          />
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500" id={`${msgId}-help`}>
            <span>できるだけ詳しくご記入ください。</span>
            <span className={cn(
              'tabular-nums transition-colors duration-200',
              message.length > 1800 && 'text-amber-500',
              message.length > 1950 && 'text-red-500 font-medium'
            )}>
              {message.length}/2000
            </span>
          </div>
          {touched.message && errors.message && (
            <p id={`${msgId}-error`} className="mt-2 text-sm text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4" />
              {errors.message}
            </p>
          )}
        </div>
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

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={status === 'loading' || Date.now() < readyAt}
        className={cn(
          'w-full inline-flex items-center justify-center gap-2',
          'px-6 py-4 rounded-xl font-semibold text-white',
          'bg-gradient-to-r from-[#00a1e9] to-[#0080c0]',
          'shadow-lg transition-all duration-300',
          'hover:from-[#0090d4] hover:to-[#0070a8] hover:shadow-xl hover:-translate-y-0.5',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00a1e9]',
          'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-lg'
        )}
      >
        {status === 'loading' ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            送信中...
          </>
        ) : (
          <>
            <Send className="w-5 h-5" />
            送信する
          </>
        )}
      </button>

      {/* エラーメッセージ */}
      {status === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">送信に失敗しました</p>
            <p className="text-sm text-red-600 mt-1">時間をおいて再度お試しください。問題が続く場合は、メールで直接ご連絡ください。</p>
          </div>
        </div>
      )}

      {/* 送信前の確認メッセージ */}
      {isValid && !touched.message && message.length >= 10 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700">入力内容を確認して「送信する」ボタンを押してください。</p>
        </div>
      )}
    </form>
  );
}
