'use client';

import { CommentItem } from './CommentItem';
import { Button } from '@/components/ui/button';
import type { Comment } from '@/lib/comments/types';

type Props = {
  comments: Comment[];
  entryId: number;
  isEntryOwner: boolean;
  currentUserId: string | null;
  onDelete: (id: string) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  loadingMore: boolean;
};

export function CommentList({
  comments,
  entryId,
  isEntryOwner,
  currentUserId,
  onDelete,
  hasMore,
  onLoadMore,
  loadingMore,
}: Props) {
  if (comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        まだコメントはありません
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y">
        {comments.map((comment) => {
          const canDelete =
            isEntryOwner || comment.user_id === currentUserId;

          return (
            <CommentItem
              key={comment.id}
              comment={comment}
              entryId={entryId}
              canDelete={canDelete}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? '読み込み中...' : 'もっと見る'}
          </Button>
        </div>
      )}
    </div>
  );
}
