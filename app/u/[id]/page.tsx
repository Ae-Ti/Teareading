import { Suspense } from "react";
import {
  ProfileSummary,
  ProfileGroups,
  ProfileStats,
} from "@/components/profile/profile-summary";
import { ProfileAvatar } from "@/components/profile/avatar";
import { PublicRecords } from "@/components/profile/public-records";
import { BlockButton } from "@/components/dm/block-button";
import { StartDmButton } from "@/components/dm/start-dm-button";
import { FriendButton } from "@/components/social/friend-button";
import { FriendsButton } from "@/components/social/friends-button";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { isBlockedByMe } from "@/lib/dm";
import {
  getPublicProfile,
  getProfileGroups,
  getPublicRecords,
  getPublicStats,
} from "@/lib/profile/data";
import { getFriendRelation, getFriends } from "@/lib/social/data";
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
  // 비공개 프로필: 다른 회원에게는 닉네임·사진과 대화·친구·차단 버튼만 보여 준다
  const hidden = !isMe && !profile.data.is_public;
  const [groups, block, activity, friends, relation, records] =
    await Promise.all([
      getProfileGroups(supabase, id),
      isMe ? null : isBlockedByMe(supabase, userId, id),
      hidden ? { stats: null, error: null } : getPublicStats(supabase, id),
      getFriends(supabase, id),
      isMe ? null : getFriendRelation(supabase, userId, id),
      hidden ? null : getPublicRecords(supabase, id),
    ]);
  return (
    <div className="mx-auto max-w-3xl space-y-7 py-8 md:py-10">
      {hidden ? (
        <Card className="flex items-center gap-5">
          <ProfileAvatar
            nickname={profile.data.nickname}
            src={profile.data.avatar_url}
          />
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold break-words">
              {profile.data.nickname}
            </h1>
            <p className="text-ink-muted">비공개 프로필이에요.</p>
          </div>
        </Card>
      ) : (
        <ProfileSummary
          profile={profile.data}
          as="h1"
          friends={<FriendsButton friends={friends} />}
        />
      )}
      {isMe && !profile.data.is_public && (
        <p className="rounded-md border-2 border-ink bg-yuja px-4 py-2 text-sm font-bold">
          비공개로 설정되어 있어요. 다른 회원에게는 닉네임과 프로필 사진만
          보여요.
        </p>
      )}
      {isMe ? (
        <LinkButton href="/mypage/edit">프로필 수정</LinkButton>
      ) : (
        <div className="flex flex-wrap items-start gap-3">
          {block?.blocked ? (
            <p className="w-full text-sm text-ink-muted">
              차단한 회원이에요. 차단을 해제하면 메시지를 주고받을 수 있어요.
            </p>
          ) : (
            <>
              <StartDmButton userId={id} />
              {relation?.relation === "friend" && (
                <LinkButton variant="secondary" href={`/space/room/${id}`}>
                  방 구경하기
                </LinkButton>
              )}
              {relation && (
                <FriendButton
                  me={userId}
                  userId={id}
                  nickname={profile.data.nickname}
                  relation={relation.relation}
                  requestId={relation.requestId}
                />
              )}
            </>
          )}
          <BlockButton
            userId={id}
            nickname={profile.data.nickname}
            blocked={Boolean(block?.blocked)}
          />
        </div>
      )}
      {!hidden && records && (
        <>
          <ProfileStats stats={activity.stats} />
          <PublicRecords userId={id} records={records} />
          <ProfileGroups result={groups} retryHref={`/u/${id}`} />
        </>
      )}
    </div>
  );
}
