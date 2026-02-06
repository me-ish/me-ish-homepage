'use client';

import { useState } from 'react';
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

  const trimmedBody = body.trim();
  const charCount = trimmedBody.length;
  const isValid = charCount >= 1 && charCount <= MAX_LENGTH;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/entries/${entryId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmedBody }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'コメントの投稿に失敗しました');
        return;
      }

      onSubmit(data.comment);
      setBody('');
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
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="コメントを入力..."
          className="min-h-[100px] resize-none"
          maxLength={MAX_LENGTH + 100}
          disabled={submitting}
        />
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {charCount}/{MAX_LENGTH}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={!isValid || submitting} size="sm">
          {submitting ? '投稿中...' : 'コメントを投稿'}
        </Button>
      </div>
    </form>
  );
}
