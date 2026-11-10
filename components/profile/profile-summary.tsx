import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { StateMessage } from "@/components/ui/state";
import { ProfileAvatar } from "./avatar";
import type { PublicProfile } from "@/lib/profile/forms";
import type { getProfileGroups, PublicStats } from "@/lib/profile/data";
import { formatDuration, formatKoreanDate } from "@/lib/time";

export function ProfileSummary({
  profile,
  email,
}: {
  profile: PublicProfile;
  email?: string;
}) {
  return (
    <Card className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
      <ProfileAvatar nickname={profile.nickname} src={profile.avatar_url} />
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="break-words text-2xl font-bold">{profile.nickname}</h2>
        <p className="whitespace-pre-wrap break-words text-ink-muted">
          {profile.bio || "아직 소개를 작성하지 않았어요."}
        </p>
        <p className="text-sm text-ink-muted">
          가입일 · {formatKoreanDate(profile.created_at)}
        </p>
        {email && (
          <p className="break-all text-sm">
            <span className="font-bold">계정 이메일</span> · {email}
          </p>
        )}
      </div>
    </Card>
  );
}

export function ProfileStats({ stats }: { stats: PublicStats | null }) {
  if (!stats)
    return <StateMessage tone="error" title="활동 통계를 불러오지 못했어요" />;
  const items = [
    { label: "연속 학습", value: `${stats.streak.toLocaleString()}일` },
    { label: "완독", value: `${stats.finished.toLocaleString()}권` },
    { label: "읽은 쪽", value: `${stats.pages.toLocaleString()}쪽` },
    { label: "독서 시간", value: formatDuration(stats.reading_seconds) },
    { label: "다도 시간", value: formatDuration(stats.tea_seconds) },
    { label: "다도 횟수", value: `${stats.tea_sessions.toLocaleString()}번` },
  ];
  return (
    <section className="space-y-4" aria-labelledby="profile-stats-heading">
      <h2 id="profile-stats-heading" className="text-xl font-bold">
        활동 통계
      </h2>
      <Card>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-muted">{item.label}</dt>
              <dd className="text-xl font-bold break-keep tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}

export function ProfileGroups({
  result,
  retryHref,
}: {
  result: Awaited<ReturnType<typeof getProfileGroups>>;
  retryHref: string;
}) {
  return (
    <section className="space-y-4" aria-labelledby="profile-groups-heading">
      <h2 id="profile-groups-heading" className="text-xl font-bold">
        참여 모임
      </h2>
      {result.error ? (
        <StateMessage
          tone="error"
          title="참여 모임을 불러오지 못했어요"
          description="잠시 후 다시 확인해 주세요."
          action={{ href: retryHref, label: "다시 확인" }}
        />
      ) : result.groups.length === 0 ? (
        <StateMessage title="아직 참여 중인 모임이 없어요" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.groups.map((group) => (
            <li key={group.id}>
              <Card className="flex h-full flex-col items-start gap-3">
                <h3 className="break-words font-bold">{group.name}</h3>
                <p className="text-xs text-ink-muted">
                  {group.role === "owner" ? "모임장" : "멤버"}
                </p>
                <p className="line-clamp-3 break-words text-sm text-ink-muted">
                  {group.description || "소개가 없는 모임이에요."}
                </p>
                <LinkButton
                  href={`/groups/${group.id}`}
                  variant="secondary"
                  size="sm"
                >
                  모임 보기
                </LinkButton>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
