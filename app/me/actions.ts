"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BODY_MAX,
  isUuid,
  RECORD_KINDS,
  TITLE_MAX,
  type RecordKind,
} from "@/lib/records";
import { requireUser } from "@/lib/supabase/user";
import { track, type Device } from "@/lib/track";

export type RecordFormState = {
  errors?: { title?: string; body?: string; form?: string };
  values?: { title: string; body: string };
};

export async function saveRecord(
  kind: RecordKind,
  id: string | null,
  device: Device | null,
  _prev: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const config = RECORD_KINDS[kind];
  if (!config) return { errors: { form: "잘못된 요청이에요." } };

  const { supabase } = await requireUser(
    id ? `${config.path}/${id}/edit` : `${config.path}/new`,
  );

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const values = { title, body };

  const errors: RecordFormState["errors"] = {};
  if (!title) errors.title = `${config.titleLabel}을 입력해 주세요.`;
  else if (title.length > TITLE_MAX)
    errors.title = `${TITLE_MAX}자 이내로 입력해 주세요.`;
  if (!body) errors.body = `${config.bodyLabel}을 입력해 주세요.`;
  else if (body.length > BODY_MAX)
    errors.body = `${BODY_MAX.toLocaleString()}자 이내로 입력해 주세요.`;
  if (errors.title || errors.body) return { errors, values };

  const payload = { [config.titleColumn]: title, body } as never;
  let savedId = id;

  if (id) {
    if (!isUuid(id))
      return { errors: { form: "기록을 찾을 수 없어요." }, values };
    const { data, error } = await supabase
      .from(config.table)
      .update(payload)
      .eq("id", id)
      .select("id");
    if (error)
      return {
        errors: { form: "저장하지 못했어요. 다시 시도해 주세요." },
        values,
      };
    if (!data?.length)
      return {
        errors: { form: "기록을 찾을 수 없거나 수정할 권한이 없어요." },
        values,
      };
  } else {
    const { data, error } = await supabase
      .from(config.table)
      .insert(payload)
      .select("id")
      .single();
    if (error)
      return {
        errors: { form: "저장하지 못했어요. 다시 시도해 주세요." },
        values,
      };
    savedId = data.id;
    await track(supabase, config.event, {}, device);
  }

  revalidatePath(config.path);
  redirect(`${config.path}/${savedId}`);
}

export async function deleteRecord(kind: RecordKind, id: string) {
  const config = RECORD_KINDS[kind];
  const { supabase } = await requireUser(`${config.path}/${id}`);
  if (!isUuid(id)) return { error: "기록을 찾을 수 없어요." };

  const { data, error } = await supabase
    .from(config.table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return { error: "삭제하지 못했어요. 다시 시도해 주세요." };
  if (!data?.length)
    return { error: "기록을 찾을 수 없거나 삭제할 권한이 없어요." };

  revalidatePath(config.path);
  redirect(config.path);
}
