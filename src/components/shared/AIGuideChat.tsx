'use client';

import { useState, useEffect } from 'react';

type AIGuideChatProps = {
  initialMessage?: string;
};

export default function AIGuideChat({ initialMessage }: AIGuideChatProps) {
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasSentInitial, setHasSentInitial] = useState(false);

  const handleSubmit = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    const res = await fetch('/api/ai-guide', {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    });
    const data = await res.json();
    setReply(data.reply);
    setInput('');
    setLoading(false);
  };

  useEffect(() => {
    if (initialMessage && !hasSentInitial) {
      handleSubmit(initialMessage);
      setHasSentInitial(true);
    }
  }, [initialMessage, hasSentInitial]);

  return (
    <div className={`fixed bottom-2 right-2 z-50 ${open ? 'w-[320px]' : ''}`}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-white border border-cyan-400 text-cyan-600 px-4 py-2 rounded-full shadow hover:bg-cyan-50"
        >
          <img src="/icons/logo-mini.png" alt="me-ish" className="w-7 h-7" />
          <span className="text-sm font-semibold">ガイドAI</span>
        </button>
      )}

      {open && (
        <div className="bg-white rounded-xl p-4 shadow-lg border border-cyan-300 relative">
          <button
            onClick={() => setOpen(false)}
            className="absolute top-1 right-2 text-sm text-cyan-600 hover:underline"
          >
            ✕ 閉じる
          </button>

          <h2 className="font-bold mb-2 text-cyan-600">me-ish ガイドAI</h2>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            className="w-full p-2 border rounded text-sm"
            placeholder="me-ishについて質問してみよう"
          />
          <button
            onClick={() => handleSubmit(input)}
            className="mt-2 w-full bg-cyan-500 text-white py-1 rounded hover:bg-cyan-600"
            disabled={loading}
          >
            {loading ? '送信中...' : '送信'}
          </button>
          {reply && (
            <div className="mt-3 p-2 bg-gray-100 rounded text-sm whitespace-pre-line">
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
