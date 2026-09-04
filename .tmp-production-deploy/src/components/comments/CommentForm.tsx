'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Props = {
  entryId: number;
  onSubmit: (comment: {
    id: string;
    body: string;
    author_name: string;
    user_id: string;
    created_at: string;
    is_own: boolean;
    is_entry_owner: boolean;
  }) => void;
  isAuthenticated: boolean;
};

const MAX_LENGTH = 1000;

export function CommentForm({ entryId, onSubmit, isAuthenticated }: Props) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedBody = body.trim();
  const charCount = trimmedBody.length;
  const isValid = charCount >= 1 && charCount <= MAX_LENGTH;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/entries/${entryId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'me-ish' },
        body: JSON.stringify({ body: trimmedBody }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'コメントの投稿に失敗しました');
        return;
      }

      onSubmit(data.comment);
      setBody('');
      setSuccessMsg('コメントを投稿しました');
      textareaRef.current?.focus();
    } catch {
      setError('コメントの投稿に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-gray-50 border rounded-lg p-4 text-center text-gray-500 text-sm">
        コメントを投稿するにはログインが必要です
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="コメントを入力..."
          className="min-h-[100px] resize-none"
          maxLength={MAX_LENGTH + 100}
          disabled={submitting}
          aria-describedby="comment-char-count"
        />
        <div id="comment-char-count" className="absolute bottom-2 right-2 text-xs text-gray-400" aria-live="polite">
          {charCount}/{MAX_LENGTH}
        </div>
      </div>

      <div aria-live="polite" className="sr-only">
        {successMsg}
      </div>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={!isValid || submitting} size="sm">
          {submitting ? '投稿中...' : 'コメントを投稿'}
        </Button>
      </div>
    </form>
  );
}
