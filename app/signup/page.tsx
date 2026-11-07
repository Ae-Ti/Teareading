import { AuthForm } from "@/components/auth/auth-form";
import { isAuthConfigured } from "@/lib/auth/config";
import { safeNextPath } from "@/lib/auth/paths";
import { Suspense } from "react";

export default function Page(props: PageProps<"/signup">) {
  return (
    <Suspense
      fallback={
        <p role="status" className="py-10">
          회원가입 화면을 불러오는 중…
        </p>
      }
    >
      <Signup {...props} />
    </Suspense>
  );
}

async function Signup({ searchParams }: PageProps<"/signup">) {
  const query = await searchParams;
  return (
    <AuthForm
      mode="signup"
      next={safeNextPath(query.next)}
      available={isAuthConfigured()}
    />
  );
}
