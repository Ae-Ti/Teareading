import { Suspense } from "react";
import {
  ProfileSummary,
  ProfileGroups,
} from "@/components/profile/profile-summary";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getPublicProfile, getProfileGroups } from "@/lib/profile/data";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "공개 프로필 · 티어리딩" };

export default function Page(props: PageProps<"/u/[id]">) {
  return (
    <Suspense fallback={<LoadingBlock className="my-8 h-64" />}>
      <PublicProfile {...props} />
    </Suspense>
  );
}

async function PublicProfile({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(
    `/u/${encodeURIComponent(id)}`,
  );
  const profile = await getPublicProfile(supabase, id);
  if (profile.error)
    return (
      <div className="py-8">
        <StateMessage
          tone="error"
          title="프로필을 불러오지 못했어요"
          action={{ href: `/u/${encodeURIComponent(id)}`, label: "다시 확인" }}
        />
      </div>
    );
  if (!profile.data)
    return (
      <div className="py-8">
        <StateMessage
          title="프로필을 찾을 수 없어요"
          description="존재하지 않거나 더 이상 이용할 수 없는 회원이에요."
          action={{ href: "/community", label: "커뮤니티로" }}
        />
      </div>
    );
  const groups = await getProfileGroups(supabase, id);
  return (
    <div className="mx-auto max-w-3xl space-y-7 py-8 md:py-10">
      <h1 className="text-3xl font-bold">공개 프로필</h1>
      <ProfileSummary profile={profile.data} />
      {userId === id && (
        <LinkButton href="/mypage/edit">프로필 수정</LinkButton>
      )}
      <ProfileGroups result={groups} retryHref={`/u/${id}`} />
    </div>
  );
}
