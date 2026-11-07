"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { login, signup } from "@/app/auth/actions";
import {
  INITIAL_AUTH_STATE,
  SERVICE_ERROR,
  type AuthField,
  type AuthMode,
  type AuthState,
} from "@/lib/auth/forms";

const inputClass =
  "mt-2 w-full rounded-md border border-neutral-400 px-3 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 aria-invalid:border-red-700";

export function AuthForm({
  mode,
  next,
  available,
  loggedOut = false,
}: {
  mode: AuthMode;
  next: string;
  available: boolean;
  loggedOut?: boolean;
}) {
  const isSignup = mode === "signup";
  const [state, action, pending] = useActionState(
    async (previous: AuthState, form: FormData): Promise<AuthState> => {
      form.set(
        "device",
        window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
      );
      try {
        return await (isSignup ? signup : login)(previous, form);
      } catch {
        // 브라우저와 앱 서버 사이의 연결 실패도 폼 안에서 재시도할 수 있다.
        return { status: "error", message: SERVICE_ERROR };
      }
    },
    INITIAL_AUTH_STATE,
  );
  // 입력값은 브라우저 메모리에만 유지한다. 비밀번호는 서버 응답에 싣지 않는다.
  const [email, setEmail] = useState(state.values?.email ?? "");
  const [nickname, setNickname] = useState(state.values?.nickname ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(
    state.values?.privacyConsent ?? false,
  );
  const [ageConfirmed, setAgeConfirmed] = useState(
    state.values?.ageConfirmed ?? false,
  );
  const completed =
    state.status === "success" || state.status === "confirm-email";

  useEffect(() => {
    // 쿠키 반영 후 새 문서를 요청해 로그인 전 라우터 캐시를 재사용하지 않는다.
    if (state.redirectTo) window.location.replace(state.redirectTo);
  }, [state.redirectTo]);

  function fieldError(field: AuthField) {
    const error = state.errors?.[field];
    return error ? (
      <p id={`${mode}-${field}-error`} className="mt-2 text-sm text-red-800">
        {error}
      </p>
    ) : null;
  }

  function errorProps(field: AuthField, hint?: string) {
    const hasError = Boolean(state.errors?.[field]);
    return {
      "aria-invalid": hasError || undefined,
      "aria-describedby":
        [hint, hasError ? `${mode}-${field}-error` : null]
          .filter(Boolean)
          .join(" ") || undefined,
    };
  }

  return (
    <section className="mx-auto w-full max-w-md py-10 sm:py-16">
      <h1 className="text-2xl font-semibold">
        {isSignup ? "회원가입" : "로그인"}
      </h1>
      <p className="mt-3 text-sm text-neutral-700">
        {isSignup
          ? "차와 책을 즐기는 시간을 티어리딩에 남겨 보세요."
          : "티어리딩에서 나의 시간을 이어가세요."}
      </p>

      {loggedOut && state.status === "idle" && (
        <p role="status" className="mt-6 text-sm">
          로그아웃했어요.
        </p>
      )}
      {!available && (
        <p role="alert" className="mt-6 text-sm text-red-800">
          {SERVICE_ERROR}
        </p>
      )}

      <form
        action={action}
        className="mt-8"
        aria-busy={pending}
        // Action 완료 시 기본 reset이 동의 체크까지 지우지 않게 한다.
        // 성공하면 새 문서로 이동하고, 실패하면 입력 상태를 유지한다.
        onReset={(event) => event.preventDefault()}
      >
        <input type="hidden" name="next" value={next} />
        <fieldset
          disabled={pending || completed || !available}
          className="min-w-0 space-y-5 disabled:opacity-70"
        >
          <legend className="sr-only">
            {isSignup ? "회원가입 정보" : "로그인 정보"}
          </legend>
          <div>
            <label htmlFor={`${mode}-email`} className="text-sm font-medium">
              이메일
            </label>
            <input
              id={`${mode}-email`}
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              {...errorProps("email")}
            />
            {fieldError("email")}
          </div>

          {isSignup && (
            <div>
              <label htmlFor="signup-nickname" className="text-sm font-medium">
                닉네임
              </label>
              <input
                id="signup-nickname"
                name="nickname"
                autoComplete="nickname"
                required
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className={inputClass}
                {...errorProps("nickname", "nickname-hint")}
              />
              <p id="nickname-hint" className="mt-2 text-sm text-neutral-600">
                2~20자, 다른 회원과 겹치지 않는 이름을 사용해 주세요. 가입할 때
                중복을 확인해요.
              </p>
              {fieldError("nickname")}
            </div>
          )}

          <div>
            <label htmlFor={`${mode}-password`} className="text-sm font-medium">
              비밀번호
            </label>
            <input
              id={`${mode}-password`}
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={isSignup ? 6 : undefined}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              {...errorProps(
                "password",
                isSignup ? "password-hint" : undefined,
              )}
            />
            {isSignup && (
              <p id="password-hint" className="mt-2 text-sm text-neutral-600">
                6자 이상 입력해 주세요.
              </p>
            )}
            {fieldError("password")}
          </div>

          {isSignup && (
            <>
              <div>
                <label
                  htmlFor="signup-passwordConfirmation"
                  className="text-sm font-medium"
                >
                  비밀번호 확인
                </label>
                <input
                  id="signup-passwordConfirmation"
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  maxLength={128}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className={inputClass}
                  {...errorProps("passwordConfirmation")}
                />
                {fieldError("passwordConfirmation")}
              </div>
              <div className="text-sm">
                <p className="mb-3 text-neutral-700">
                  서비스 이용 전{" "}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    이용약관 (새 창)
                  </a>
                  과{" "}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4"
                  >
                    개인정보처리방침 (새 창)
                  </a>
                  을 확인해 주세요.
                </p>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name="privacyConsent"
                    required
                    checked={privacyConsent}
                    onChange={(event) =>
                      setPrivacyConsent(event.target.checked)
                    }
                    className="size-5 shrink-0"
                    {...errorProps("privacyConsent")}
                  />
                  개인정보 수집·이용에 동의합니다. (필수)
                </label>
                {fieldError("privacyConsent")}
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    name="ageConfirmed"
                    required
                    checked={ageConfirmed}
                    onChange={(event) => setAgeConfirmed(event.target.checked)}
                    className="size-5 shrink-0"
                    {...errorProps("ageConfirmed")}
                  />
                  만 14세 이상입니다. (필수)
                </label>
                {fieldError("ageConfirmed")}
              </div>
            </>
          )}

          <button
            type="submit"
            className="min-h-12 w-full rounded-md bg-neutral-900 px-4 py-3 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait"
            disabled={pending}
          >
            {pending
              ? isSignup
                ? "가입하는 중…"
                : "로그인하는 중…"
              : isSignup
                ? "회원가입"
                : "로그인"}
          </button>
        </fieldset>

        <div aria-live="polite" aria-atomic="true">
          {state.message && (
            <p
              role={state.status === "error" ? "alert" : "status"}
              className={`mt-5 text-sm ${state.status === "error" ? "text-red-800" : "text-neutral-800"}`}
            >
              {state.message}
            </p>
          )}
          {state.redirectTo && (
            <a
              href={state.redirectTo}
              className="mt-3 inline-block underline underline-offset-4"
            >
              계속하기
            </a>
          )}
        </div>
      </form>

      <p className="mt-8 text-sm">
        {isSignup ? "이미 계정이 있나요? " : "아직 계정이 없나요? "}
        <Link
          href={`${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(next)}`}
          className="font-medium underline underline-offset-4"
        >
          {isSignup ? "로그인" : "회원가입"}
        </Link>
      </p>
    </section>
  );
}
