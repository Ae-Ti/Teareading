import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { track } from "@/lib/track";
import {
  authErrorMessage,
  SERVICE_ERROR,
  validateAuthForm,
  type AuthMode,
  type AuthState,
} from "./forms";
import { safeNextPath } from "./paths";

type ClientFactory = () => Promise<SupabaseClient<Database>>;

export async function authenticate(
  mode: AuthMode,
  form: FormData,
  getClient: ClientFactory,
): Promise<AuthState> {
  const { values, password, errors, valid } = validateAuthForm(mode, form);
  if (!valid) {
    return {
      status: "error",
      message: "입력한 내용을 확인해 주세요.",
      errors,
      values,
    };
  }

  try {
    const supabase = await getClient();
    if (mode === "signup") {
      const { data: available, error } = await supabase.rpc(
        "is_nickname_available",
        { p_nickname: values.nickname },
      );
      if (error) return { status: "error", message: SERVICE_ERROR, values };
      if (!available) {
        return {
          status: "error",
          message: "다른 닉네임을 선택해 주세요.",
          errors: { nickname: "이미 사용 중인 닉네임이에요." },
          values,
        };
      }
    }

    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email: values.email,
            password,
            options: { data: { nickname: values.nickname } },
          })
        : await supabase.auth.signInWithPassword({
            email: values.email,
            password,
          });

    if (error) {
      // 사전 확인 후 다른 사용자가 닉네임을 선점한 경우도 DB 제약으로 처리한다.
      if (mode === "signup" && error.code === "unexpected_failure") {
        const { data: available } = await supabase.rpc(
          "is_nickname_available",
          {
            p_nickname: values.nickname,
          },
        );
        if (available === false) {
          return {
            status: "error",
            message: "다른 닉네임을 선택해 주세요.",
            errors: { nickname: "이미 사용 중인 닉네임이에요." },
            values,
          };
        }
      }
      return { status: "error", message: authErrorMessage(error.code), values };
    }

    // 이메일 인증 사용 시 기존 계정에 대해 난독화된 사용자 응답이 올 수 있다.
    if (mode === "signup" && data.user?.identities?.length === 0) {
      return {
        status: "error",
        message: "가입 정보를 확인해 주세요. 이미 가입했다면 로그인해 주세요.",
        values,
      };
    }
    if (!data.user || (mode === "login" && !data.session)) {
      return { status: "error", message: SERVICE_ERROR, values };
    }

    const device = form.get("device");
    // 분석 서비스 실패가 이미 성공한 인증을 실패로 바꾸지 않게 한다.
    await track(
      supabase,
      mode === "signup" ? "signup_completed" : "login_completed",
      {},
      device === "mobile" || device === "desktop" ? device : null,
    ).catch(() => undefined);

    if (!data.session) {
      return {
        status: "confirm-email",
        message:
          "가입 확인 메일을 보냈어요. 이메일 인증을 마친 뒤 로그인해 주세요.",
        values,
      };
    }
    return {
      status: "success",
      message: mode === "signup" ? "가입이 완료됐어요." : "로그인했어요.",
      redirectTo: safeNextPath(form.get("next")),
    };
  } catch {
    return { status: "error", message: SERVICE_ERROR, values };
  }
}

export async function endSession(getClient: ClientFactory): Promise<AuthState> {
  try {
    const supabase = await getClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { status: "error", message: SERVICE_ERROR };
    return {
      status: "success",
      message: "로그아웃했어요.",
      redirectTo: "/login?loggedOut=1",
    };
  } catch {
    return { status: "error", message: SERVICE_ERROR };
  }
}
