"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addComment,
  deleteComment,
  setCommentLike,
  updateComment,
  type CommentState,
} from "@/app/board/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { COMMENT_MAX, formatBoardDateTime, type Comment } from "@/lib/board";
import { AuthorChip } from "./author-chip";

export function CommentForm({
  postId,
  parentId,
  onDone,
}: {
  postId: string;
  parentId?: string;
  onDone?: () => void;
}) {
  const noun = parentId ? "답글" : "댓글";
  const fieldId = parentId ? `reply-${parentId}` : "comment-body";
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
      onDone?.();
    }
  }, [ok, onDone]);

  return (
    <form action={action} className="flex flex-col gap-2">
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <label htmlFor={fieldId} className="sr-only">
        {noun} 입력
      </label>
      <textarea
        id={fieldId}
        name="body"
        rows={parentId ? 2 : 3}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`${noun}을 남겨 보세요`}
        aria-invalid={state.error ? true : undefined}
        className="w-full resize-y rounded-md border-2 border-ink bg-surface p-3 leading-relaxed placeholder:text-ink-subtle focus:shadow-hard-sm focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">
          {[...value].length} / {COMMENT_MAX.toLocaleString()}자
        </span>
        <Button size="sm" loading={pending} disabled={!value.trim()}>
          {noun} 등록
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

function CommentLike({
  comment,
  postId,
  disabled,
}: {
  comment: Comment;
  postId: string;
  disabled: boolean;
}) {
  const [liked, setLiked] = useState(comment.liked);
  const [count, setCount] = useState(comment.like_count);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toggle = () => {
    const next = !liked;
    setFailed(null);
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    startTransition(async () => {
      try {
        const res = await setCommentLike(comment.id, postId, next);
        if (res.error) throw new Error(res.error);
        setLiked(res.liked!);
        setCount(res.count!);
      } catch (e) {
        setLiked(!next);
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        setFailed(
          e instanceof Error && e.message
            ? e.message
            : "처리하지 못했어요. 다시 시도해 주세요.",
        );
      }
    });
  };
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || pending}
        aria-pressed={liked}
        aria-label={`댓글 추천 ${count}`}
        title={disabled ? "내 댓글은 추천할 수 없어요" : undefined}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm border-2 border-ink px-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:border-ink-subtle disabled:text-ink-muted",
          liked ? "bg-hongcha" : "bg-surface",
        )}
      >
        <span aria-hidden>{liked ? "♥" : "♡"}</span>
        <span className="font-mono">{count}</span>
      </button>
      {failed && (
        <span role="alert" className="text-xs text-danger">
          {failed}
        </span>
      )}
    </>
  );
}

export function CommentItem({
  comment,
  postId,
  mine,
  byPostAuthor,
  hasReplies,
  children,
}: {
  comment: Comment;
  postId: string;
  mine: boolean;
  byPostAuthor: boolean;
  hasReplies?: boolean;
  children?: React.ReactNode;
}) {
  const [replying, setReplying] = useState(false);
  const closeReply = useCallback(() => setReplying(false), []);
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
                if (
                  window.confirm(
                    hasReplies
                      ? "답글도 함께 삭제돼요. 댓글을 삭제할까요?"
                      : "댓글을 삭제할까요?",
                  )
                )
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
      <div className="flex flex-wrap items-center gap-2">
        <CommentLike comment={comment} postId={postId} disabled={mine} />
        {/* 답글은 댓글에만 달 수 있다 (답글의 답글은 불가) */}
        {!comment.parent_id && (
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            aria-expanded={replying}
            className="text-xs font-bold text-ink-muted underline underline-offset-2 hover:text-ink"
          >
            답글
          </button>
        )}
      </div>
      {replying && (
        <div className="ml-4 md:ml-8">
          <CommentForm
            postId={postId}
            parentId={comment.id}
            onDone={closeReply}
          />
        </div>
      )}
      {children}
    </li>
  );
}
