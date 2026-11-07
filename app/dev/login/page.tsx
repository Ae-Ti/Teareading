import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DevLoginForm } from "./dev-login-form";

export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 py-12">
      <div>
        <h1 className="text-2xl font-bold">개발용 로그인</h1>
        <p className="text-sm text-ink-muted">
          웅싯의 로그인 화면이 나오기 전까지 쓰는 임시 화면이에요. 없는
          이메일이면 바로 가입돼요.
        </p>
      </div>
      <Suspense>
        <DevLoginForm />
      </Suspense>
    </div>
  );
}
