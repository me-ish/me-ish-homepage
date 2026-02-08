'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import type { Comment } from '@/lib/comments/types';

type Props = {
  comment: Comment;
  entryId: number;
  canDelete: boolean;
  onDelete: (id: string) => void;
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'たった今';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CommentItem({ comment, entryId, canDelete, onDelete }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/entries/${entryId}/comments/${comment.id}`,
        { method: 'DELETE', headers: { 'x-requested-with': 'me-ish' } }
      );

      if (res.ok) {
        onDelete(comment.id);
        setOpen(false);
      }
    } catch {
      // Silent fail
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="border-b last:border-b-0 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Author & Time */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900 truncate">
              {comment.author_name}
            </span>
            {comment.is_entry_owner && (
              <Badge variant="secondary" className="text-xs">
                作者
              </Badge>
            )}
            <span className="text-xs text-gray-400">
              {formatRelativeTime(comment.created_at)}
            </span>
          </div>

          {/* Body */}
          <p className="text-gray-700 whitespace-pre-wrap break-words">
            {comment.body}
          </p>
        </div>

        {/* Delete Button */}
        {canDelete && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-red-500 shrink-0"
                disabled={deleting}
              >
                削除
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>コメントを削除</DialogTitle>
                <DialogDescription>
                  このコメントを削除しますか？この操作は取り消せません。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">キャンセル</Button>
                </DialogClose>
                <Button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleting ? '削除中...' : '削除'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
