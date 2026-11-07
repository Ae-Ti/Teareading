import Link from "next/link";
import { Suspense } from "react";
import { updateGroup } from "@/app/groups/actions";
import { MiniAvatar } from "@/components/groups/avatar";
import { GroupForm } from "@/components/groups/group-form";
import { RemoveMemberButton } from "@/components/groups/remove-member-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getGroup } from "@/lib/groups";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "모임 관리 · 티어리딩" };

export default function Page(props: PageProps<"/groups/[id]/manage">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <Suspense fallback={<LoadingBlock className="h-96" />}>
        <Manage params={props.params} />
      </Suspense>
    </div>
  );
}

async function Manage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(`/groups/${id}/manage`);
  const { group, members, error } = await getGroup(supabase, id);

  if (error)
    return <StateMessage tone="error" title="모임을 불러오지 못했어요" />;
  if (!group) {
    return (
      <StateMessage
        title="모임을 찾을 수 없어요"
        action={{ href: "/community", label: "커뮤니티로" }}
      />
    );
  }
  if (group.owner_id !== userId) {
    return (
      <StateMessage
        title="모임장만 볼 수 있는 화면이에요"
        description="모임 정보 수정과 멤버 관리는 모임장만 할 수 있어요."
        action={{ href: `/groups/${group.id}`, label: "모임으로 돌아가기" }}
      />
    );
  }

  return (
    <>
      <Link
        href={`/groups/${group.id}`}
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← {group.name}
      </Link>
      <h1 className="text-2xl font-bold md:text-3xl">모임 관리</h1>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">모임 정보</h2>
        <GroupForm
          action={updateGroup.bind(null, group.id)}
          initial={{ name: group.name, description: group.description }}
          submitLabel="저장"
          cancelHref={`/groups/${group.id}`}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">
          멤버 <span className="font-mono">{members.length}</span>명
        </h2>
        <ul className="flex flex-col divide-y-2 divide-sunken">
          {members.map((m) => (
            <li
              key={m.profile.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="flex items-center gap-3">
                <MiniAvatar
                  nickname={m.profile.nickname}
                  src={m.profile.avatar_url}
                />
                <span className="font-bold">{m.profile.nickname}</span>
                {m.role === "owner" && <Badge tone="yuja">모임장</Badge>}
              </span>
              {m.role !== "owner" && (
                <RemoveMemberButton
                  groupId={group.id}
                  memberId={m.profile.id}
                  nickname={m.profile.nickname}
                />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
