// src/components/shared/AIGuideChat.tsx
'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Send, X, Mic, MicOff, Sparkles, Loader2, ExternalLink, RotateCcw } from 'lucide-react';
import { useZoomArtworkOptional } from './ZoomArtworkContext';

/* ===== 最小の SpeechRecognition 型定義 ===== */
type ISpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

/* ===== 会話メッセージ型 ===== */
type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/* ===== Props ===== */
export type AIGuideChatProps = {
  initialMessage?: string;

  /** 新API（推奨） */
  controlledOpen?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** 旧API（後方互換） */
  open?: boolean;
  onClose?: () => void;

  /** 内部状態で使う場合の初期値（任意） */
  defaultOpen?: boolean;
};

export default function AIGuideChat({
  initialMessage,
  controlledOpen,
  onOpenChange,
  // 旧API
  open,
  onClose,
  defaultOpen = false,
}: AIGuideChatProps) {
  /* -------------------------------
   * 作品ズーム中は非表示
   * ----------------------------- */
  const zoomContext = useZoomArtworkOptional();
  const isArtworkZoomed = !!zoomContext?.zoomedArtwork;

  /* -------------------------------
   * 開閉（ハンドラ同梱時のみ制御扱い）
   * ----------------------------- */
  const hasNewControl =
    typeof controlledOpen === 'boolean' && typeof onOpenChange === 'function';
  const hasOldControl =
    typeof open === 'boolean' && typeof onOpenChange === 'function';

  const isControlled = hasNewControl || hasOldControl;
  const controlled = hasNewControl ? controlledOpen : hasOldControl ? open : undefined;

  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen);
  const [animateIn, setAnimateIn] = useState(false);
  const isOpen = isControlled ? Boolean(controlled) : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (next) {
      if (isControlled) {
        onOpenChange?.(true);
      } else {
        setUncontrolledOpen(true);
      }
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
      setTimeout(() => {
        if (isControlled) {
          onOpenChange?.(false);
          onClose?.();
        } else {
          setUncontrolledOpen(false);
        }
      }, 200);
    }
  };

  // 初回オープン時のアニメーション
  useEffect(() => {
    if (isOpen && !animateIn) {
      requestAnimationFrame(() => setAnimateIn(true));
    }
  }, [isOpen]);

  /* -------------------------------
   * 会話の状態
   * ----------------------------- */
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSentInitial, setHasSentInitial] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // スクロールを末尾に
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }, []);

  /* -------------------------------
   * 音声認識（マウント後にだけセット）
   * ----------------------------- */
  type SR = ISpeechRecognition;
  const recognitionRef = useRef<SR | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [srSupported, setSrSupported] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      (!!window.webkitSpeechRecognition || !!window.SpeechRecognition);
    setSrSupported(supported);

    if (!supported) return;

    const SRImpl = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SRImpl) return;

    const recognition = new SRImpl();
    recognition.lang = 'ja-JP';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript ?? '';
      if (!transcript) return;
      setInput(transcript);
      void handleSubmit(transcript);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  /* -------------------------------
   * 初回メッセージ（マウント後に一度だけ）
   * ----------------------------- */
  useEffect(() => {
    if (!initialMessage || hasSentInitial) return;
    void handleSubmit(initialMessage);
    setHasSentInitial(true);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessage, hasSentInitial]);

  /* -------------------------------
   * 送信処理
   * ----------------------------- */
  const handleSubmit = async (text: string) => {
    const q = text?.trim();
    if (!q) return;

    const userMsg: ChatMessage = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      // 送信する履歴を構築（今回のメッセージは含めず、過去分のみ）
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      });
      const data = await res.json().catch(() => ({}));
      const answer: string = data?.reply ?? '（応答を取得できませんでした）';

      const assistantMsg: ChatMessage = { role: 'assistant', content: answer };
      setMessages((prev) => [...prev, assistantMsg]);
      scrollToBottom();

      // TTS（対応ブラウザのみ）
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(answer);
          utt.lang = 'ja-JP';
          window.speechSynthesis.speak(utt);
        } catch {}
      }
    } catch {
      const errorMsg: ChatMessage = { role: 'assistant', content: 'エラーが発生しました。少し時間をおいてお試しください。' };
      setMessages((prev) => [...prev, errorMsg]);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput('');
  };

  const startListening = () => {
    if (!srSupported || !recognitionRef.current) return;
    try {
      setIsRecording(true);
      recognitionRef.current.start();
    } catch {
      setIsRecording(false);
    }
  };
  const stopListening = () => {
    if (!srSupported || !recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsRecording(false);
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  /* -------------------------------
   * Render
   * ----------------------------- */
  if (isArtworkZoomed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {/* 閉じた状態: フローティングボタン */}
      {!isOpen && (
        <button
          onClick={() => setOpen(true)}
          className="
            group flex items-center gap-2.5
            px-4 py-2.5 rounded-full
            bg-black/60 backdrop-blur-xl
            border border-white/20
            text-white
            shadow-lg shadow-black/20
            hover:bg-black/70 hover:border-cyan-400/50 hover:shadow-cyan-500/20
            transition-all duration-300
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black
          "
          aria-label="ガイドAIを開く"
          type="button"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-inner">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="text-sm font-medium">ガイドAI</span>
        </button>
      )}

      {/* 開いた状態: チャットパネル */}
      {isOpen && (
        <div
          className={`
            w-[340px] max-h-[70vh] flex flex-col
            rounded-2xl overflow-hidden
            bg-gray-900/95 backdrop-blur-xl
            border border-white/10
            shadow-2xl shadow-black/40
            transition-all duration-200 ease-out origin-bottom-right
            ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}
          `}
          role="dialog"
          aria-modal="true"
          aria-label="me-ish ガイドAI"
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm">me-ish ガイドAI</h2>
                <p className="text-white/50 text-xs">作品や展示について質問できます</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleReset}
                  className="
                    w-8 h-8 rounded-lg flex items-center justify-center
                    text-white/60 hover:text-white hover:bg-white/10
                    transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
                  "
                  aria-label="会話をリセット"
                  type="button"
                  title="会話をリセット"
                >
                  <RotateCcw size={16} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="
                  w-8 h-8 rounded-lg flex items-center justify-center
                  text-white/60 hover:text-white hover:bg-white/10
                  transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
                "
                aria-label="閉じる"
                type="button"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* メインコンテンツ（スクロール可能） */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[120px]">
            {/* 初期メッセージ（会話がまだない場合） */}
            {messages.length === 0 && !loading && (
              <div className="text-center py-4">
                <p className="text-white/60 text-sm mb-3">
                  何でも聞いてください
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['おすすめの作品は？', '展示中の作品を見たい', '購入方法を教えて'].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSubmit(q)}
                      className="
                        px-3 py-1.5 rounded-full
                        bg-white/10 hover:bg-white/20
                        text-white/80 text-xs
                        transition-colors
                      "
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 会話履歴 */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-cyan-500/20 text-white/90 rounded-br-md'
                      : 'bg-white/5 border border-white/10 text-white/90 rounded-bl-md'
                    }
                  `}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* ローディング */}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white/5 border border-white/10">
                  <Loader2 size={16} className="text-cyan-400 animate-spin" />
                  <span className="text-white/60 text-sm">考え中...</span>
                </div>
              </div>
            )}
          </div>

          {/* 入力エリア */}
          <div className="p-3 border-t border-white/10 bg-white/5">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  className="
                    w-full px-4 py-2.5 pr-10
                    bg-white/10 hover:bg-white/15 focus:bg-white/15
                    border border-white/10 focus:border-cyan-400/50
                    rounded-xl
                    text-white text-sm placeholder-white/40
                    resize-none
                    transition-colors
                    focus:outline-none focus:ring-1 focus:ring-cyan-400/50
                  "
                  placeholder="メッセージを入力..."
                  style={{ minHeight: '44px', maxHeight: '100px' }}
                />
                {/* マイクボタン（入力欄内） */}
                {srSupported && (
                  <button
                    onClick={isRecording ? stopListening : startListening}
                    className={`
                      absolute right-2 top-1/2 -translate-y-1/2
                      w-7 h-7 rounded-lg flex items-center justify-center
                      transition-all
                      ${isRecording
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/10'
                      }
                    `}
                    aria-label={isRecording ? '音声入力を停止' : '音声入力を開始'}
                    type="button"
                  >
                    {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                )}
              </div>

              {/* 送信ボタン */}
              <button
                onClick={() => handleSubmit(input)}
                disabled={loading || !input.trim()}
                className="
                  w-11 h-11 rounded-xl flex items-center justify-center
                  bg-gradient-to-r from-cyan-500 to-blue-500
                  hover:from-cyan-400 hover:to-blue-400
                  disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed
                  text-white
                  shadow-lg shadow-cyan-500/30 disabled:shadow-none
                  transition-all
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400
                "
                type="button"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          </div>

          {/* フッター */}
          <div className="px-4 py-2 border-t border-white/5 bg-black/20">
            <p className="text-white/40 text-[11px] text-center">
              不具合がありましたら{' '}
              <a
                href="/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400/70 hover:text-cyan-400 inline-flex items-center gap-0.5"
              >
                お問い合わせ
                <ExternalLink size={10} />
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
