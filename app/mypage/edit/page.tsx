import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { ProfileForm } from "@/components/profile/profile-form";
import { requireUser } from "@/lib/supabase/user";
import { PUBLIC_PROFILE_FIELDS } from "@/lib/profile/forms";

export const metadata = { title: "프로필 수정 · 티어리딩" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock className="my-8 h-96" />}>
      <EditProfile />
    </Suspense>
  );
}

async function EditProfile() {
  const { supabase, userId } = await requireUser("/mypage/edit");
  const result = await supabase
    .from("profiles")
    .select(`${PUBLIC_PROFILE_FIELDS},updated_at`)
    .eq("id", userId)
    .maybeSingle();
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8 md:py-10">
      <h1 className="text-3xl font-bold">프로필 수정</h1>
      {result.error || !result.data ? (
        <StateMessage
          tone="error"
          title="프로필을 불러오지 못했어요"
          action={{ href: "/mypage/edit", label: "다시 확인" }}
        />
      ) : (
        <Card>
          <ProfileForm profile={result.data} />
        </Card>
      )}
    </div>
  );
}
