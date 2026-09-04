export type Comment = {
  id: string;
  body: string;
  author_name: string;
  user_id: string;
  created_at: string;
  is_own: boolean;
  is_entry_owner: boolean;
};

export type CommentCreatePayload = {
  body: string;
};

export type CommentListResponse = {
  comments: Comment[];
  total: number;
  hasMore: boolean;
};

export type CommentCreateResponse = {
  comment: Comment;
};

export type CommentDeleteResponse = {
  ok: boolean;
};

export type CommentErrorResponse = {
  error: string;
};
