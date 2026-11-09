"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  isBookStatus,
  validateBook,
  type BookErrors,
  type BookStatus,
  type BookValues,
} from "@/lib/books";
import { isUuid } from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";

export type BookFormState = {
  errors?: BookErrors;
  values?: BookValues;
  saved?: number;
};

const refresh = () => revalidatePath("/me", "layout");

export async function saveBook(
  id: string | null,
  prev: BookFormState,
  form: FormData,
): Promise<BookFormState> {
  const { supabase } = await requireUser("/me/reading");
  const { values, errors } = validateBook(form);
  if (errors) return { errors, values };

  const payload = { ...values, author: values.author || null };
  let failed = false;
  let code: string | undefined;
  if (id) {
    if (!isUuid(id))
      return { errors: { form: "책을 찾을 수 없어요." }, values };
    const { data, error } = await supabase
      .from("books")
      .update(payload)
      .eq("id", id)
      .select("id");
    failed = Boolean(error) || !data?.length;
    code = error?.code;
  } else {
    const { error } = await supabase.from("books").insert(payload);
    failed = Boolean(error);
    code = error?.code;
  }
  if (failed)
    return code === "23505"
      ? { errors: { title: "이미 서재에 있는 책이에요." }, values }
      : { errors: { form: "저장하지 못했어요. 다시 시도해 주세요." }, values };

  refresh();
  return { saved: (prev.saved ?? 0) + 1 };
}

export async function setBookStatus(id: string, status: BookStatus) {
  const { supabase } = await requireUser("/me/reading");
  if (!isUuid(id) || !isBookStatus(status))
    return { error: "책을 찾을 수 없어요." };
  const { data, error } = await supabase
    .from("books")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || !data?.length)
    return { error: "상태를 바꾸지 못했어요. 다시 시도해 주세요." };
  refresh();
  return { error: null };
}

export async function deleteBook(id: string) {
  const { supabase } = await requireUser("/me/reading");
  if (!isUuid(id)) return { error: "책을 찾을 수 없어요." };
  const { data, error } = await supabase
    .from("books")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !data?.length)
    return { error: "삭제하지 못했어요. 다시 시도해 주세요." };
  refresh();
  redirect("/me/reading");
}
