'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommentForm } from './CommentForm';
import { CommentList } from './CommentList';
import { supabase } from '@/lib/supabaseClient';
import type { Comment } from '@/lib/comments/types';

type Props = {
  entryId: number;
  entryOwnerId?: string;
};

const LIMIT = 20;

export function CommentSection({ entryId, entryOwnerId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 認証状態を取得
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
      setIsAuthenticated(!!user);
    };
    checkAuth();
  }, []);

  // コメント取得
  const fetchComments = useCallback(
    async (offset = 0, append = false) => {
      try {
        const res = await fetch(
          `/api/entries/${entryId}/comments?limit=${LIMIT}&offset=${offset}`
        );
        const data = await res.json();

        if (res.ok) {
          if (append) {
            setComments((prev) => [...prev, ...data.comments]);
          } else {
            setComments(data.comments);
          }
          setTotal(data.total);
          setHasMore(data.hasMore);
        }
      } catch {
        // Silent fail
      }
    },
    [entryId]
  );

  useEffect(() => {
    setLoading(true);
    fetchComments(0, false).finally(() => setLoading(false));
  }, [fetchComments]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchComments(comments.length, true);
    setLoadingMore(false);
  };

  const handleNewComment = (comment: Comment) => {
    setComments((prev) => [...prev, comment]);
    setTotal((prev) => prev + 1);
  };

  const handleDelete = (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id));
    setTotal((prev) => prev - 1);
  };

  const isEntryOwner = currentUserId === entryOwnerId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          コメント
          {total > 0 && (
            <span className="text-sm font-normal text-gray-500">({total})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comment Form */}
        <CommentForm
          entryId={entryId}
          onSubmit={handleNewComment}
          isAuthenticated={isAuthenticated}
        />

        {/* Comment List */}
        {loading ? (
          <div className="text-center py-8 text-gray-400">読み込み中...</div>
        ) : (
          <CommentList
            comments={comments}
            entryId={entryId}
            isEntryOwner={isEntryOwner}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
            loadingMore={loadingMore}
          />
        )}
      </CardContent>
    </Card>
  );
}
