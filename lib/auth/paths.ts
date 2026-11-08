const PROTECTED_PATHS = [
  "/dashboard",
  "/attendance",
  "/space",
  "/me",
  "/community",
  "/board",
  "/groups",
  "/dm",
  "/mypage",
  "/u",
] as const;

export function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function isAuthPath(pathname: string) {
  return ["/login", "/signup"].includes(pathname.replace(/\/$/, ""));
}

// next는 요청 쿼리/hidden input에서 오므로 서버에서도 반드시 다시 검증한다.
export function safeNextPath(value: unknown): string {
  const fallback = "/dashboard";
  if (typeof value !== "string" || value.length > 2048) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      decoded.startsWith("//") ||
      /[\\\u0000-\u0020\u007f]/.test(value) ||
      /[\\\u0000-\u001f\u007f]/.test(decoded)
    ) {
      return fallback;
    }

    const base = "https://teareading.invalid";
    const url = new URL(value, base);
    if (
      url.origin !== base ||
      url.pathname.startsWith("//") ||
      isAuthPath(url.pathname)
    ) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
