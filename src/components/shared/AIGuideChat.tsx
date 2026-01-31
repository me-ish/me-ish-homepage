// src/components/shared/AIGuideChat.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Mic, MicOff } from 'lucide-react';
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
    typeof open === 'boolean' && typeof onOpenChange === 'function'; // onClose だけでは制御にしない

  const isControlled = hasNewControl || hasOldControl;
  const controlled = hasNewControl ? controlledOpen : hasOldControl ? open : undefined;

  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean>(defaultOpen);
  const isOpen = isControlled ? Boolean(controlled) : uncontrolledOpen;

  const setOpen = (next: boolean) => {
    if (isControlled) {
      onOpenChange?.(next);   // 親に通知
      if (!next) onClose?.(); // 旧API互換のクローズ通知
    } else {
      setUncontrolledOpen(next);
    }
  };

  /* -------------------------------
   * 会話の状態
   * ----------------------------- */
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSentInitial, setHasSentInitial] = useState(false);

  /* -------------------------------
   * 音声認識（マウント後にだけセット）
   * ----------------------------- */
  type SR = ISpeechRecognition;
  const recognitionRef = useRef<SR | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [srSupported, setSrSupported] = useState(false);

  useEffect(() => {
    // Mic対応可否はマウント後に判定（SSR差分防止）
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
    // 自動送信 & パネルを開く
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

    setLoading(true);
    try {
      const res = await fetch('/api/ai-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json().catch(() => ({}));
      const answer: string = data?.reply ?? '（応答を取得できませんでした）';

      setReply(answer);
      setInput('');

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
      setReply('エラーが発生しました。少し時間をおいてお試しください。');
    } finally {
      setLoading(false);
    }
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

  /* -------------------------------
   * Render
   * ----------------------------- */
  // 作品ズーム中は完全に非表示
  if (isArtworkZoomed) return null;

  return (
    <div className={`fixed bottom-2 right-2 z-[9999] ${isOpen ? 'w-[320px]' : ''}`}>
      {!isOpen && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-white border border-cyan-400 text-cyan-600 px-4 py-2 rounded-full shadow hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
          aria-label="ガイドAIを開く"
          type="button"
        >
          <img src="/icons/logo-mini.png" alt="" className="w-7 h-7" />
          <span className="text-sm font-semibold">ガイドAI</span>
        </button>
      )}

      {isOpen && (
        <div
          className="bg-white rounded-xl p-4 shadow-lg border border-cyan-300 relative w-[320px]"
          role="dialog"
          aria-modal="true"
          aria-label="me-ish ガイドAI"
        >
          <button
            onClick={() => setOpen(false)}
            className="absolute top-1 right-2 text-sm text-cyan-600 hover:underline inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 rounded"
            aria-label="ガイドAIを閉じる"
            type="button"
          >
            <X size={14} /> 閉じる
          </button>

          <h2 className="font-bold mb-2 text-cyan-600 flex items-center gap-2 text-sm">
            <MessageCircle size={18} /> me-ish ガイドAI
          </h2>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            className="w-full p-2 border rounded text-sm"
            placeholder="me-ishについて質問してみよう"
          />

          <div className="flex items-center gap-2 mt-2">
            {/* Micはマウント後に対応判定して描画（SSR差分を防ぐ） */}
            {srSupported && (
              <button
                onClick={isRecording ? stopListening : startListening}
                className="text-cyan-600 hover:text-cyan-800"
                aria-label={isRecording ? '音声入力を停止' : '音声入力を開始'}
                type="button"
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}

            <button
              onClick={() => handleSubmit(input)}
              className="flex-1 bg-cyan-500 text-white py-1 rounded hover:bg-cyan-600 inline-flex items-center justify-center gap-1 disabled:opacity-60"
              disabled={loading}
              type="button"
            >
              <Send size={16} />
              {loading ? '送信中...' : '送信'}
            </button>
          </div>

          {!!reply && (
            <div className="mt-3 p-2 bg-gray-100 rounded text-sm whitespace-pre-line" aria-live="polite">
              {reply}
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500 text-center">
            不具合などがありましたか？{' '}
            <a
              href="/contact"
              className="text-cyan-600 underline hover:text-cyan-800"
              target="_blank"
              rel="noopener noreferrer"
            >
              お問い合わせはこちら
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
  