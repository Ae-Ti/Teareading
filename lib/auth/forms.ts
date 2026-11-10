import { hasHiddenChars, hasVisibleText } from "@/lib/text";

export type AuthMode = "login" | "signup";
export type AuthField =
  | "email"
  | "password"
  | "nickname"
  | "passwordConfirmation"
  | "privacyConsent"
  | "ageConfirmed";

export type AuthValues = {
  email: string;
  nickname: string;
  privacyConsent: boolean;
  ageConfirmed: boolean;
};

export type AuthState = {
  status: "idle" | "error" | "success" | "confirm-email";
  message?: string;
  errors?: Partial<Record<AuthField, string>>;
  values?: AuthValues;
  redirectTo?: string;
};

export const INITIAL_AUTH_STATE: AuthState = { status: "idle" };
export const SERVICE_ERROR =
  "인증 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";

function textField(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

export function validateAuthForm(mode: AuthMode, form: FormData) {
  const values: AuthValues = {
    email: textField(form, "email").trim(),
    nickname: textField(form, "nickname").trim(),
    privacyConsent: form.get("privacyConsent") === "on",
    ageConfirmed: form.get("ageConfirmed") === "on",
  };
  // 비밀번호는 공백도 원문의 일부다. 반환 state나 로그에 포함하지 않는다.
  const password = textField(form, "password");
  const errors: Partial<Record<AuthField, string>> = {};

  if (
    values.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)
  ) {
    errors.email = "올바른 이메일 주소를 입력해 주세요.";
  }
  if (!password || password.length > 128) {
    errors.password = "비밀번호를 1~128자로 입력해 주세요.";
  }

  if (mode === "signup") {
    if (password.length < 6) {
      errors.password = "비밀번호는 6자 이상 입력해 주세요.";
    }
    // Postgres char_length와 같이 유니코드 코드 포인트 단위로 검사한다.
    const nicknameLength = [...values.nickname].length;
    if (nicknameLength < 2 || nicknameLength > 20) {
      errors.nickname = "닉네임은 2~20자로 입력해 주세요.";
    } else if (
      !hasVisibleText(values.nickname) ||
      hasHiddenChars(values.nickname)
    ) {
      errors.nickname = "닉네임에 쓸 수 없는 글자가 있어요.";
    }
    if (password !== textField(form, "passwordConfirmation")) {
      errors.passwordConfirmation = "비밀번호가 일치하지 않아요.";
    }
    if (!values.privacyConsent) {
      errors.privacyConsent = "개인정보 수집·이용에 동의해 주세요.";
    }
    if (!values.ageConfirmed) {
      errors.ageConfirmed = "만 14세 이상만 가입할 수 있어요.";
    }
  }

  return { values, password, errors, valid: Object.keys(errors).length === 0 };
}

export function authErrorMessage(code?: string) {
  switch (code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호를 확인해 주세요.";
    case "user_already_exists":
    case "email_exists":
      return "이미 가입된 이메일이에요. 로그인해 주세요.";
    case "email_not_confirmed":
      return "이메일 인증을 마친 뒤 로그인해 주세요.";
    case "weak_password":
      return "더 안전한 비밀번호를 사용해 주세요. 다른 비밀번호로 다시 시도해 주세요.";
    case "email_address_invalid":
      return "올바른 이메일 주소를 입력해 주세요.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "요청이 많아요. 잠시 기다린 뒤 다시 시도해 주세요.";
    case "signup_disabled":
      return "지금은 새 회원가입을 받고 있지 않아요.";
    default:
      return SERVICE_ERROR;
  }
}
