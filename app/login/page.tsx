import { AuthForm } from "@/components/auth/auth-form";
import { isAuthConfigured } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/paths";
import { Suspense } from "react";

export default function Page(props: PageProps<"/login">) {
  return (
    <Suspense
      fallback={
        <p role="status" className="py-10">
          로그인 화면을 불러오는 중…
        </p>
      }
    >
      <Login {...props} />
    </Suspense>
  );
}

async function Login({ searchParams }: PageProps<"/login">) {
  const query = await searchParams;
  return (
    <AuthForm
      mode="login"
      next={safeNextPath(query.next)}
      available={isAuthConfigured()}
      loggedOut={query.loggedOut === "1"}
    />
  );
}
