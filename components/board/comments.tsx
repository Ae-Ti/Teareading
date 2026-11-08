"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addComment,
  deleteComment,
  updateComment,
  type CommentState,
} from "@/app/board/actions";
import { Button } from "@/components/ui/button";
import { COMMENT_MAX, formatBoardDateTime, type Comment } from "@/lib/board";
import { AuthorChip } from "./author-chip";

export function CommentForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState<CommentState, FormData>(
    addComment.bind(null, postId),
    { error: null },
  );
  const [value, setValue] = useState("");
  const ok = state.ok;
  const lastOk = useRef(ok);
  // 등록에 성공하면 입력창을 비운다
  useEffect(() => {
    if (ok && ok !== lastOk.current) {
      lastOk.current = ok;
      setValue("");
    }
  }, [ok]);

  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="comment-body" className="sr-only">
        댓글 입력
      </label>
      <textarea
        id="comment-body"
        name="body"
        rows={3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="댓글을 남겨 보세요"
        aria-invalid={state.error ? true : undefined}
        className="w-full resize-y rounded-md border-2 border-ink bg-surface p-3 leading-relaxed placeholder:text-ink-subtle focus:shadow-hard-sm focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">
          {[...value].length} / {COMMENT_MAX.toLocaleString()}자
        </span>
        <Button size="sm" loading={pending} disabled={!value.trim()}>
          댓글 등록
        </Button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function CommentItem({
  comment,
  postId,
  mine,
  byPostAuthor,
}: {
  comment: Comment;
  postId: string;
  mine: boolean;
  byPostAuthor: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(comment.body);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const edited =
    Date.parse(comment.updated_at) - Date.parse(comment.created_at) > 1000;

  const run = (
    fn: () => Promise<{ error: string | null }>,
    after?: () => void,
  ) =>
    startTransition(async () => {
      setError(null);
      try {
        const res = await fn();
        if (res.error) setError(res.error);
        else after?.();
      } catch {
        setError("처리하지 못했어요. 다시 시도해 주세요.");
      }
    });

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <AuthorChip author={comment.author} size="xs" />
        {byPostAuthor && (
          <span className="rounded-sm border border-ink px-1 text-[11px] font-bold">
            글쓴이
          </span>
        )}
        <time dateTime={comment.created_at} className="text-xs text-ink-muted">
          {formatBoardDateTime(comment.created_at)}
          {edited && " (수정됨)"}
        </time>
        {mine && !editing && (
          <span className="ml-auto flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setEditing(true)}
            >
              수정
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              loading={pending}
              onClick={() => {
                if (window.confirm("댓글을 삭제할까요?"))
                  run(() => deleteComment(comment.id, postId));
              }}
            >
              삭제
            </Button>
          </span>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={`edit-${comment.id}`} className="sr-only">
            댓글 수정
          </label>
          <textarea
            id={`edit-${comment.id}`}
            rows={3}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-md border-2 border-ink bg-surface p-3 leading-relaxed focus:shadow-hard-sm focus:outline-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              loading={pending}
              onClick={() =>
                run(
                  () => updateComment(comment.id, postId, value),
                  () => setEditing(false),
                )
              }
            >
              저장
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue(comment.body);
                setEditing(false);
              }}
            >
              취소
            </Button>
          </div>
        </div>
      ) : (
        <p className="leading-relaxed break-words whitespace-pre-wrap">
          {comment.body}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
