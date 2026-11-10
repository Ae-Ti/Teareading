import { Suspense } from "react";
import {
  ProfileSummary,
  ProfileGroups,
  ProfileStats,
} from "@/components/profile/profile-summary";
import { BlockButton } from "@/components/dm/block-button";
import { StartDmButton } from "@/components/dm/start-dm-button";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { isBlockedByMe } from "@/lib/dm";
import {
  getPublicProfile,
  getProfileGroups,
  getPublicStats,
} from "@/lib/profile/data";
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
  const isMe = userId === id;
  const [groups, block, activity] = await Promise.all([
    getProfileGroups(supabase, id),
    isMe ? null : isBlockedByMe(supabase, userId, id),
    getPublicStats(supabase, id),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-7 py-8 md:py-10">
      <h1 className="text-3xl font-bold">공개 프로필</h1>
      <ProfileSummary profile={profile.data} />
      {isMe ? (
        <LinkButton href="/mypage/edit">프로필 수정</LinkButton>
      ) : (
        <div className="flex flex-wrap items-start gap-3">
          {block?.blocked ? (
            <p className="w-full text-sm text-ink-muted">
              차단한 회원이에요. 차단을 해제하면 메시지를 주고받을 수 있어요.
            </p>
          ) : (
            <StartDmButton userId={id} />
          )}
          <BlockButton
            userId={id}
            nickname={profile.data.nickname}
            blocked={Boolean(block?.blocked)}
          />
        </div>
      )}
      <ProfileStats stats={activity.stats} />
      <ProfileGroups result={groups} retryHref={`/u/${id}`} />
    </div>
  );
}
