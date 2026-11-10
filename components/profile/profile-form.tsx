"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/mypage/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LinkButton } from "@/components/ui/link-button";
import { ProfileAvatar } from "./avatar";
import {
  AVATAR_INPUT_TYPES,
  INITIAL_PROFILE_STATE,
  MAX_AVATAR_BYTES,
  PROFILE_SAVE_ERROR,
  type EditableProfile,
  type ProfileState,
} from "@/lib/profile/forms";

export function ProfileForm({ profile }: { profile: EditableProfile }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, action, pending] = useActionState(
    async (previous: ProfileState, form: FormData): Promise<ProfileState> => {
      form.set(
        "device",
        window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      );
      try {
        const result = await updateProfile(previous, form);
        if (result.status === "success" && result.profile) {
          setNickname(result.profile.nickname);
          setBio(result.profile.bio ?? "");
          setRemoveAvatar(false);
          setPreview(null);
          setFileError(null);
          if (previewRef.current) URL.revokeObjectURL(previewRef.current);
          previewRef.current = null;
          if (fileInput.current) fileInput.current.value = "";
          router.refresh();
        }
        return result;
      } catch {
        return { status: "error", message: PROFILE_SAVE_ERROR };
      }
    },
    INITIAL_PROFILE_STATE,
  );
  const current = state.profile ?? profile;

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  useEffect(() => {
    if (state.redirectTo) window.location.replace(state.redirectTo);
  }, [state.redirectTo]);

  function selectAvatar(file?: File) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setFileError(null);
    if (!file) return;
    if (
      file.size > MAX_AVATAR_BYTES ||
      !AVATAR_INPUT_TYPES.includes(file.type)
    ) {
      setFileError("2MB 이하의 JPEG, PNG, WebP 이미지를 선택해 주세요.");
      return;
    }
    setRemoveAvatar(false);
    previewRef.current = URL.createObjectURL(file);
    setPreview(previewRef.current);
  }

  return (
    <form
      action={action}
      onReset={(event) => event.preventDefault()}
      aria-busy={pending}
      className="space-y-6"
    >
      <input type="hidden" name="revision" value={current.updated_at} />
      <fieldset
        disabled={pending}
        className="min-w-0 space-y-6 disabled:opacity-60"
      >
        <legend className="sr-only">프로필 수정 정보</legend>
        <section className="space-y-4" aria-labelledby="avatar-heading">
          <h2 id="avatar-heading" className="font-bold">
            프로필 이미지
          </h2>
          {preview ? (
            // 브라우저에서 선택한 로컬 이미지의 임시 미리보기다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="새 프로필 이미지 미리보기"
              className="size-24 rounded-full border-2 border-ink object-cover"
            />
          ) : (
            <ProfileAvatar
              nickname={nickname || profile.nickname}
              src={removeAvatar ? null : current.avatar_url}
            />
          )}
          <label className="flex flex-col gap-2 text-sm font-bold">
            새 이미지 선택
            <input
              ref={fileInput}
              type="file"
              name="avatar"
              accept={AVATAR_INPUT_TYPES.join(",")}
              onChange={(event) => selectAvatar(event.target.files?.[0])}
              aria-invalid={
                Boolean(fileError || state.errors?.avatar) || undefined
              }
              aria-describedby="avatar-hint avatar-error"
              className="block w-full min-w-0 rounded-md border-2 border-ink bg-surface p-3 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-matcha file:px-3 file:py-2"
            />
          </label>
          <p id="avatar-hint" className="text-sm text-ink-muted">
            JPEG, PNG, WebP · 최대 2MB, 1,600만 화소. 아바타 이미지는 공개돼요.
            원본 위치 정보는 저장하지 않아요.
          </p>
          <p
            id="avatar-error"
            className="text-sm text-danger"
            aria-live="polite"
          >
            {fileError || state.errors?.avatar}
          </p>
          {current.avatar_url && (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="removeAvatar"
                checked={removeAvatar}
                onChange={(event) => {
                  setRemoveAvatar(event.target.checked);
                  if (event.target.checked) {
                    if (fileInput.current) fileInput.current.value = "";
                    selectAvatar();
                  }
                }}
                className="size-5"
              />
              현재 이미지 삭제
            </label>
          )}
        </section>

        <Input
          name="nickname"
          label="닉네임"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          required
          hint="2~20자. 다른 회원과 겹치지 않는 이름을 사용해 주세요."
          error={state.errors?.nickname}
          autoComplete="nickname"
        />
        <Textarea
          name="bio"
          label="한 줄 소개"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          hint={`${[...bio].length}/100자 · 다른 회원에게 공개돼요.`}
          error={state.errors?.bio}
          className="min-h-28"
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending} disabled={Boolean(fileError)}>
            프로필 저장
          </Button>
          <LinkButton href="/mypage" variant="secondary">
            내 프로필로
          </LinkButton>
        </div>
      </fieldset>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "text-danger" : "text-ink"}
        >
          {state.message}
        </p>
      )}
      {state.status === "error" && (
        <a
          href="/mypage/edit"
          className="inline-block text-sm underline underline-offset-4"
        >
          최신 프로필 다시 불러오기
        </a>
      )}
    </form>
  );
}
