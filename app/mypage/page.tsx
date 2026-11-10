import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  ProfileSummary,
  ProfileGroups,
} from "@/components/profile/profile-summary";
import { MyActivity } from "@/components/profile/my-activity";
import { FriendsButton } from "@/components/social/friends-button";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import {
  getMyActivity,
  getPublicProfile,
  getProfileGroups,
} from "@/lib/profile/data";
import { getFriends } from "@/lib/social/data";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "내 프로필 · 티어리딩" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock className="my-8 h-64" />}>
      <MyPage />
    </Suspense>
  );
}

async function MyPage() {
  const { supabase, userId } = await requireUser("/mypage");
  const [profile, groups, auth, friends, activity] = await Promise.all([
    getPublicProfile(supabase, userId),
    getProfileGroups(supabase, userId),
    supabase.auth.getUser(),
    getFriends(supabase, userId),
    getMyActivity(supabase, userId),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-7 py-8 md:py-10">
      <h1 className="text-3xl font-bold">내 프로필</h1>
      {profile.error || !profile.data ? (
        <StateMessage
          tone="error"
          title="프로필을 불러오지 못했어요"
          action={{ href: "/mypage", label: "다시 확인" }}
        />
      ) : (
        <>
          <ProfileSummary
            profile={profile.data}
            email={auth.data.user?.email}
            friends={<FriendsButton friends={friends} />}
          >
            <LinkButton href="/mypage/edit" size="sm">
              프로필 수정
            </LinkButton>
            <LinkButton href={`/u/${userId}`} variant="secondary" size="sm">
              내 공개 프로필
            </LinkButton>
            <LinkButton href="/me" variant="secondary" size="sm">
              내 기록 보기
            </LinkButton>
          </ProfileSummary>
          <MyActivity activity={activity} />
          <ProfileGroups result={groups} retryHref="/mypage" />
        </>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-ink-subtle pt-2">
        <LogoutButton />
        <Link
          href="/mypage/delete"
          className="text-sm text-ink-muted underline underline-offset-4 hover:text-danger"
        >
          회원 탈퇴
        </Link>
      </div>
    </div>
  );
}
