"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  imagesOf,
  validateComment,
  validatePost,
  type PostErrors,
  type PostValues,
} from "@/lib/board";
import { preparePostImage } from "@/lib/profile/image";
import { isUuid } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { track } from "@/lib/track";

export type PostFormState = { errors?: PostErrors; values?: PostValues };

const SAVE_ERROR = "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

// 글에 넣을 사진 업로드: 서버에서 다시 인코딩해 위치 정보 등을 지우고 저장한다
export async function uploadPostImage(form: FormData) {
  const { supabase, userId } = await requireUser("/board/new");
  const file = form.get("image");
  if (!(file instanceof File)) return { error: "사진을 골라 주세요." };
  let bytes: Buffer;
  try {
    bytes = await preparePostImage(file);
  } catch {
    return { error: "사진은 5MB 이하의 JPG, PNG, WebP만 올릴 수 있어요." };
  }
  const path = `${userId}/${randomUUID()}.webp`;
  const bucket = supabase.storage.from("post-images");
  const { error } = await bucket.upload(path, bytes, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { error: "사진을 올리지 못했어요. 다시 시도해 주세요." };
  return { url: bucket.getPublicUrl(path).data.publicUrl };
}

// 글에서 빠진 사진 파일을 지운다. 실패해도 글 저장은 그대로 둔다
async function removeImages(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  urls: string[],
) {
  const marker = "/storage/v1/object/public/post-images/";
  const paths = urls.flatMap((u) => {
    const at = u.indexOf(marker);
    return at < 0 ? [] : [u.slice(at + marker.length)];
  });
  if (paths.length)
    await supabase.storage
      .from("post-images")
      .remove(paths)
      .catch(() => null);
}

export async function createPost(
  _prev: PostFormState,
  form: FormData,
): Promise<PostFormState> {
  const { supabase, userId } = await requireUser("/board/new");
  const { values, errors } = validatePost(form, userId);
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
  const { supabase, userId } = await requireUser(`/board/${id}/edit`);
  const { values, errors } = validatePost(form, userId);
  if (errors) return { errors, values };
  if (!isUuid(id)) return { errors: { form: "글을 찾을 수 없어요." }, values };

  const before = await supabase
    .from("posts")
    .select("content")
    .eq("id", id)
    .eq("author_id", userId)
    .maybeSingle();
  const { data, error } = await supabase
    .from("posts")
    .update(values)
    .eq("id", id)
    .select("id");
  if (error) return { errors: { form: SAVE_ERROR }, values };
  if (!data?.length)
    return { errors: { form: "작성자만 글을 수정할 수 있어요." }, values };

  const kept = new Set(imagesOf(values.content));
  await removeImages(
    supabase,
    imagesOf(before.data?.content).filter((u) => !kept.has(u)),
  );
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
    .select("id, content");
  if (error) return { error: "삭제하지 못했어요. 다시 시도해 주세요." };
  if (!data?.length) return { error: "작성자만 글을 삭제할 수 있어요." };
  await removeImages(supabase, imagesOf(data[0].content));
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
  const rawParent = form.get("parent_id");
  const parent_id =
    typeof rawParent === "string" && rawParent ? rawParent : undefined;
  if (parent_id && !isUuid(parent_id))
    return { error: "답글을 달 댓글을 찾을 수 없어요." };
  const res = await supabase
    .from("post_comments")
    .insert({ post_id: postId, body, parent_id });
  if (res.error)
    return {
      error:
        res.error.code === "23503"
          ? "삭제된 글이나 댓글이에요."
          : res.error.code === "22023"
            ? "답글에는 답글을 달 수 없어요."
            : "댓글을 남기지 못했어요. 다시 시도해 주세요.",
    };
  revalidatePath(`/board/${postId}`);
  revalidatePath("/board");
  // ok 값이 바뀌면 입력창을 비운다
  return { error: null, ok: (prev.ok ?? 0) + 1 };
}

// 댓글 추천/취소. 결과 추천 수를 돌려준다.
export async function setCommentLike(
  commentId: string,
  postId: string,
  like: boolean,
) {
  const { supabase, userId } = await requireUser(`/board/${postId}`);
  if (!isUuid(commentId)) return { error: "댓글을 찾을 수 없어요." };
  const res = like
    ? await supabase.from("comment_likes").insert({ comment_id: commentId })
    : await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", userId);
  // 이미 추천한 상태(중복 요청)는 성공으로 본다
  if (res.error && res.error.code !== "23505")
    return {
      error:
        res.error.code === "42501"
          ? "내 댓글은 추천할 수 없어요."
          : "처리하지 못했어요. 다시 시도해 주세요.",
    };
  const { data } = await supabase
    .from("post_comments")
    .select("like_count")
    .eq("id", commentId)
    .maybeSingle();
  return { error: null, liked: like, count: data?.like_count ?? 0 };
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
