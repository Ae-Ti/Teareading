import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import {
  ProfileSummary,
  ProfileGroups,
} from "@/components/profile/profile-summary";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getPublicProfile, getProfileGroups } from "@/lib/profile/data";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "마이페이지 · 티어리딩" };

export default function Page() {
  return (
    <Suspense fallback={<LoadingBlock className="my-8 h-64" />}>
      <MyPage />
    </Suspense>
  );
}

async function MyPage() {
  const { supabase, userId } = await requireUser("/mypage");
  const [profile, groups, auth] = await Promise.all([
    getPublicProfile(supabase, userId),
    getProfileGroups(supabase, userId),
    supabase.auth.getUser(),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-7 py-8 md:py-10">
      <h1 className="text-3xl font-bold">마이페이지</h1>
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
          />
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/mypage/edit">프로필 수정</LinkButton>
            <LinkButton href={`/u/${userId}`} variant="secondary">
              내 공개 프로필
            </LinkButton>
            <LinkButton href="/me" variant="secondary">
              내 기록 보기
            </LinkButton>
          </div>
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
