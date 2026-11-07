import { ComingSoon } from "@/components/layout/coming-soon";
import { LogoutButton } from "@/components/auth/logout-button";

export default function Page() {
  return (
    <>
      <ComingSoon title="마이페이지" owner="웅싯" day="D3" />
      <LogoutButton />
    </>
  );
}
