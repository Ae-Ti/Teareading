import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { Pagination } from "@/components/ui/pagination";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import {
  GROUP_PAGE_SIZE,
  groupsHref,
  listGroups,
  parseGroupQuery,
} from "@/lib/groups";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "커뮤니티 · 티어리딩" };

export default function Page(props: PageProps<"/community">) {
  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">커뮤니티</h1>
          <p className="text-sm text-ink-muted">
            차와 책을 좋아하는 사람들의 모임을 찾아보세요.
          </p>
        </div>
        <LinkButton href="/groups/new" size="sm" className="shrink-0">
          모임 만들기
        </LinkButton>
      </div>
      <Suspense fallback={<LoadingBlock />}>
        <GroupList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function GroupList({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseGroupQuery(await searchParams);
  const { supabase, userId } = await requireUser(groupsHref(query));
  const { groups, total, page, error } = await listGroups(
    supabase,
    userId,
    query,
  );

  if (error) {
    return (
      <StateMessage
        tone="error"
        title="모임 목록을 불러오지 못했어요"
        description="잠시 후 새로고침해 주세요."
      />
    );
  }
  const pages = Math.max(1, Math.ceil(total / GROUP_PAGE_SIZE));

  return (
    <>
      <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-ink-muted">
          {query.q ? `'${query.q}' 검색 결과 ` : "모임 "}
          <span className="font-mono font-bold text-ink">{total}</span>개
        </p>
        <Form action="/community" className="flex w-full gap-2 md:w-auto">
          <label htmlFor="group-q" className="sr-only">
            모임 검색어
          </label>
          <input
            id="group-q"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder="모임 이름이나 소개"
            maxLength={50}
            className="h-10 min-w-0 flex-1 rounded-md border-2 border-ink bg-surface px-3 text-sm md:w-56"
          />
          <button
            type="submit"
            className="h-10 shrink-0 rounded-md border-2 border-ink bg-matcha px-3 text-sm font-bold"
          >
            검색
          </button>
        </Form>
      </div>
      {groups.length === 0 ? (
        query.q ? (
          <StateMessage
            title="검색 결과가 없어요"
            description="다른 검색어로 찾아보세요."
            action={{ href: "/community", label: "검색 지우기" }}
          />
        ) : (
          <StateMessage
            title="아직 모임이 없어요"
            description="첫 모임을 만들어 함께 읽을 사람을 모아 보세요."
            action={{ href: "/groups/new", label: "모임 만들기" }}
          />
        )
      ) : (
        <ul aria-label="모임 목록" className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/groups/${g.id}`} className="block h-full">
                <Card className="flex h-full flex-col gap-2 p-4 shadow-hard-sm transition hover:-translate-y-px hover:shadow-hard">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-bold break-words">{g.name}</h2>
                    {g.joined && <Badge tone="matcha">참여 중</Badge>}
                  </div>
                  {g.description && (
                    <p className="line-clamp-2 text-sm text-ink-muted">
                      {g.description}
                    </p>
                  )}
                  <p className="mt-auto text-xs text-ink-subtle">
                    모임장 {g.ownerNickname} · 멤버{" "}
                    <span className="font-mono">{g.memberCount}</span>명
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <Pagination
          page={page}
          pages={pages}
          hrefFor={(n) => groupsHref(query, { page: n })}
        />
      )}
    </>
  );
}
