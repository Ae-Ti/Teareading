import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { track } from "@/lib/track";
import {
  avatarObjectPath,
  PROFILE_SAVE_ERROR,
  PUBLIC_PROFILE_FIELDS,
  validateProfile,
  type EditableProfile,
  type ProfileState,
} from "./forms";
import { prepareAvatar } from "./image";

export async function saveProfile(
  form: FormData,
  getClient: () => Promise<SupabaseClient<Database>>,
): Promise<ProfileState> {
  const input = validateProfile(form);
  if (Object.keys(input.errors).length) {
    return {
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      errors: input.errors,
    };
  }
  if (!input.revision || Number.isNaN(Date.parse(input.revision))) {
    return {
      status: "error",
      message: "페이지를 새로고침한 뒤 다시 저장해 주세요.",
    };
  }

  let client: SupabaseClient<Database> | undefined;
  let uploadedPath: string | null = null;
  let saved = false;
  try {
    client = await getClient();
    const { data: auth, error: authError } = await client.auth.getUser();
    if (
      authError &&
      authError.name !== "AuthSessionMissingError" &&
      authError.status !== 401 &&
      authError.status !== 403
    ) {
      return { status: "error", message: PROFILE_SAVE_ERROR };
    }
    if (authError || !auth.user) {
      return {
        status: "error",
        message: "다시 로그인해 주세요.",
        redirectTo: "/login?next=%2Fmypage%2Fedit",
      };
    }
    const userId = auth.user.id;
    const original = await client
      .from("profiles")
      .select(`${PUBLIC_PROFILE_FIELDS},updated_at`)
      .eq("id", userId)
      .maybeSingle();
    if (original.error || !original.data)
      return { status: "error", message: PROFILE_SAVE_ERROR };
    if (original.data.updated_at !== input.revision) {
      return {
        status: "error",
        message:
          "다른 화면에서 프로필이 변경됐어요. 새로고침한 뒤 다시 수정해 주세요.",
      };
    }
    if (input.nickname.toLowerCase() !== original.data.nickname.toLowerCase()) {
      const availability = await client.rpc("is_nickname_available", {
        p_nickname: input.nickname,
      });
      if (availability.error)
        return { status: "error", message: PROFILE_SAVE_ERROR };
      if (!availability.data) {
        return {
          status: "error",
          message: "다른 닉네임을 선택해 주세요.",
          errors: { nickname: "이미 사용 중인 닉네임이에요." },
        };
      }
    }

    let avatarUrl = original.data.avatar_url;
    if (input.avatar) {
      let image: Buffer;
      try {
        image = await prepareAvatar(input.avatar);
      } catch {
        return {
          status: "error",
          message: "이미지를 확인해 주세요.",
          errors: {
            avatar:
              "올바른 JPEG, PNG, WebP 정지 이미지를 선택해 주세요. 최대 1,600만 화소까지 사용할 수 있어요.",
          },
        };
      }
      const path = `${userId}/${randomUUID()}.webp`;
      const upload = await client.storage.from("avatars").upload(path, image, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });
      if (upload.error)
        return {
          status: "error",
          message:
            "이미지를 올리지 못했어요. 기존 프로필은 유지돼요. 다시 시도해 주세요.",
        };
      uploadedPath = path;
      avatarUrl = client.storage.from("avatars").getPublicUrl(path)
        .data.publicUrl;
    } else if (input.removeAvatar) {
      avatarUrl = null;
    }

    const result = await client
      .from("profiles")
      .update({
        nickname: input.nickname,
        bio: input.bio || null,
        avatar_url: avatarUrl,
      })
      .eq("id", userId)
      .eq("updated_at", input.revision)
      .select(`${PUBLIC_PROFILE_FIELDS},updated_at`)
      .maybeSingle();
    if (result.error) {
      if (result.error.code === "23505") {
        return {
          status: "error",
          message: "다른 닉네임을 선택해 주세요.",
          errors: { nickname: "이미 사용 중인 닉네임이에요." },
        };
      }
      return { status: "error", message: PROFILE_SAVE_ERROR };
    }
    if (!result.data)
      return {
        status: "error",
        message:
          "다른 화면에서 프로필이 변경됐어요. 새로고침한 뒤 다시 수정해 주세요.",
      };
    saved = true;

    const oldPath = avatarObjectPath(original.data.avatar_url, userId);
    if (oldPath && avatarUrl !== original.data.avatar_url) {
      await client.storage
        .from("avatars")
        .remove([oldPath])
        .catch(() => undefined);
    }
    const device = form.get("device");
    await track(
      client,
      "profile_updated",
      {},
      device === "mobile" || device === "desktop" ? device : null,
    ).catch(() => undefined);
    return {
      status: "success",
      message: "프로필을 저장했어요.",
      profile: result.data as EditableProfile,
    };
  } catch {
    return { status: "error", message: PROFILE_SAVE_ERROR };
  } finally {
    // 저장 실패 시 새 이미지 값만 정리한다. 기존 이미지는 건드리지 않는다.
    if (client && uploadedPath && !saved) {
      await client.storage
        .from("avatars")
        .remove([uploadedPath])
        .catch(() => undefined);
    }
  }
}
