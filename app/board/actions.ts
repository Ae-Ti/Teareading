"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  validateComment,
  validatePost,
  type PostErrors,
  type PostValues,
} from "@/lib/board";
import { isUuid } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { track } from "@/lib/track";

export type PostFormState = { errors?: PostErrors; values?: PostValues };

const SAVE_ERROR = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

export async function createPost(
  _prev: PostFormState,
  form: FormData,
): Promise<PostFormState> {
  const { supabase } = await requireUser("/board/new");
  const { values, errors } = validatePost(form);
  if (errors) return { errors, values };

  const { data, error } = await supabase
    .from("posts")
    .insert(values)
    .select("id")
    .single();
  if (error) return { errors: { form: SAVE_ERROR }, values };

  const device = form.get("device");
  await track(
    supabase,
    "post_created",
    { post_id: data.id, category: values.category },
    device === "mobile" || device === "desktop" ? device : null,
  );
  revalidatePath("/board");
  redirect(`/board/${data.id}`);
}

export async function updatePost(
  id: string,
  _prev: PostFormState,
  form: FormData,
): Promise<PostFormState> {
  const { supabase } = await requireUser(`/board/${id}/edit`);
  const { values, errors } = validatePost(form);
  if (errors) return { errors, values };
  if (!isUuid(id)) return { errors: { form: "글을 찾을 수 없어요." }, values };

  const { data, error } = await supabase
    .from("posts")
    .update(values)
    .eq("id", id)
    .select("id");
  if (error) return { errors: { form: SAVE_ERROR }, values };
  if (!data?.length)
    return { errors: { form: "작성자만 글을 수정할 수 있어요." }, values };

  revalidatePath("/board");
  revalidatePath(`/board/${id}`);
  redirect(`/board/${id}`);
}

export async function deletePost(id: string) {
  const { supabase } = await requireUser(`/board/${id}`);
  if (!isUuid(id)) return { error: "글을 찾을 수 없어요." };
  const { data, error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: "삭제하지 못했어요. 다시 시도해 주세요." };
  if (!data?.length) return { error: "작성자만 글을 삭제할 수 있어요." };
  revalidatePath("/board");
  redirect("/board");
}

// 추천/추천 취소. 결과 추천 수를 돌려준다.
export async function setLike(id: string, like: boolean) {
  const { supabase, userId } = await requireUser(`/board/${id}`);
  if (!isUuid(id)) return { error: "글을 찾을 수 없어요." };
  const res = like
    ? await supabase.from("post_likes").insert({ post_id: id })
    : await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", id)
        .eq("user_id", userId);
  // 이미 추천한 상태(중복 요청)는 성공으로 본다
  if (res.error && res.error.code !== "23505")
    return {
      error:
        res.error.code === "42501"
          ? "내 글은 추천할 수 없어요."
          : "처리하지 못했어요. 다시 시도해 주세요.",
    };
  const { data } = await supabase
    .from("posts")
    .select("like_count")
    .eq("id", id)
    .maybeSingle();
  revalidatePath("/board");
  return { error: null, liked: like, count: data?.like_count ?? 0 };
}

export type CommentState = { error: string | null; ok?: number };

export async function addComment(
  postId: string,
  prev: CommentState,
  form: FormData,
): Promise<CommentState> {
  const { supabase } = await requireUser(`/board/${postId}`);
  const { body, error } = validateComment(String(form.get("body") ?? ""));
  if (error) return { error };
  if (!isUuid(postId)) return { error: "글을 찾을 수 없어요." };
  const res = await supabase
    .from("post_comments")
    .insert({ post_id: postId, body });
  if (res.error)
    return {
      error:
        res.error.code === "23503"
          ? "삭제된 글이에요."
          : "댓글을 남기지 못했어요. 다시 시도해 주세요.",
    };
  revalidatePath(`/board/${postId}`);
  revalidatePath("/board");
  // ok 값이 바뀌면 입력창을 비운다
  return { error: null, ok: (prev.ok ?? 0) + 1 };
}

export async function deleteComment(commentId: string, postId: string) {
  const { supabase } = await requireUser(`/board/${postId}`);
  if (!isUuid(commentId)) return { error: "댓글을 찾을 수 없어요." };
  const { data, error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .select("id");
  if (error) return { error: "삭제하지 못했어요. 다시 시도해 주세요." };
  if (!data?.length) return { error: "작성자만 댓글을 삭제할 수 있어요." };
  revalidatePath(`/board/${postId}`);
  revalidatePath("/board");
  return { error: null };
}

export async function updateComment(
  commentId: string,
  postId: string,
  raw: string,
) {
  const { supabase } = await requireUser(`/board/${postId}`);
  const { body, error } = validateComment(raw);
  if (error) return { error };
  if (!isUuid(commentId)) return { error: "댓글을 찾을 수 없어요." };
  const res = await supabase
    .from("post_comments")
    .update({ body })
    .eq("id", commentId)
    .select("id");
  if (res.error) return { error: "수정하지 못했어요. 다시 시도해 주세요." };
  if (!res.data?.length) return { error: "작성자만 댓글을 수정할 수 있어요." };
  revalidatePath(`/board/${postId}`);
  return { error: null };
}

// 조회수: 같은 사람은 하루 1번만 센다 (DB 함수가 판단)
export async function recordView(postId: string) {
  const { supabase } = await requireUser(`/board/${postId}`);
  if (!isUuid(postId)) return;
  await supabase.rpc("record_post_view", { p_post_id: postId });
}
