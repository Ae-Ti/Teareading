import { hasHiddenChars, hasVisibleText } from "@/lib/text";
import type { Tables } from "@/types/database";

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const AVATAR_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PUBLIC_PROFILE_FIELDS =
  "id,nickname,bio,avatar_url,created_at,is_public";
export type PublicProfile = Pick<
  Tables<"profiles">,
  "id" | "nickname" | "bio" | "avatar_url" | "created_at" | "is_public"
>;
export type EditableProfile = PublicProfile & { updated_at: string };
export type ProfileState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Partial<Record<"nickname" | "bio" | "avatar", string>>;
  profile?: EditableProfile;
  redirectTo?: string;
};
export const INITIAL_PROFILE_STATE: ProfileState = { status: "idle" };
export const PROFILE_SAVE_ERROR =
  "프로필을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function validateProfile(form: FormData) {
  const nickname = text(form, "nickname").trim();
  const bio = text(form, "bio").trim();
  const revision = text(form, "revision");
  const removeAvatar = form.get("removeAvatar") === "on";
  const value = form.get("avatar");
  const avatar = value instanceof File && value.size > 0 ? value : null;
  const errors: NonNullable<ProfileState["errors"]> = {};
  if ([...nickname].length < 2 || [...nickname].length > 20) {
    errors.nickname = "닉네임은 2~20자로 입력해 주세요.";
  } else if (!hasVisibleText(nickname) || hasHiddenChars(nickname)) {
    errors.nickname = "닉네임에 쓸 수 없는 글자가 있어요.";
  }
  if ([...bio].length > 100) errors.bio = "소개는 100자 이내로 입력해 주세요.";
  if (avatar) {
    if (avatar.size > MAX_AVATAR_BYTES) {
      errors.avatar = "이미지는 2MB 이하로 선택해 주세요.";
    } else if (!AVATAR_INPUT_TYPES.includes(avatar.type)) {
      errors.avatar = "JPEG, PNG, WebP 이미지만 사용할 수 있어요.";
    }
  }
  if (removeAvatar && avatar) {
    errors.avatar = "이미지 변경과 삭제 중 하나만 선택해 주세요.";
  }
  return { nickname, bio, revision, avatar, removeAvatar, errors };
}

// 표시할 이미지는 이 프로젝트의 아바타 URL만 허용한다.
export function avatarObjectPath(value: string | null, ownerId?: string) {
  if (!value || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/avatars/`;
  if (!value.startsWith(base)) return null;
  const path = value.slice(base.length);
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  if (!new RegExp(`^${uuid}/${uuid}\\.webp$`).test(path)) return null;
  if (ownerId && !path.startsWith(`${ownerId}/`)) return null;
  return path;
}
