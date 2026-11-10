import Link from "next/link";
import { Suspense } from "react";
import { ProfileVisibility } from "@/components/profile/profile-visibility";
import { Card } from "@/components/ui/card";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "개인 설정 · 티어리딩" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl space-y-7 py-8 md:py-10">
      <h1 className="text-3xl font-bold">개인 설정</h1>
      <Suspense fallback={<LoadingBlock className="h-64" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

const SHOWN = [
  ["닉네임, 프로필 사진", "보여요", "보여요"],
  ["한 줄 소개, 가입일", "보여요", "숨겨요"],
  ["활동 통계, 읽은 책", "보여요", "숨겨요"],
  ["친구 목록, 참여 모임", "보여요", "숨겨요"],
  ["공개로 지정한 차 칼럼·독서기록", "보여요", "숨겨요"],
  ["비공개로 지정한 차 칼럼·독서기록", "숨겨요", "숨겨요"],
];

async function Settings() {
  const { supabase, userId } = await requireUser("/mypage/settings");
  const count = (
    table: "tea_columns" | "reading_logs",
    onlyPublic: boolean,
  ) => {
    const query = supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    return onlyPublic ? query.eq("is_public", true) : query;
  };
  const [profile, columns, publicColumns, logs, publicLogs] = await Promise.all(
    [
      supabase.from("profiles").select("is_public").eq("id", userId).single(),
      count("tea_columns", false),
      count("tea_columns", true),
      count("reading_logs", false),
      count("reading_logs", true),
    ],
  );
  if (profile.error)
    return (
      <StateMessage
        tone="error"
        title="설정을 불러오지 못했어요"
        action={{ href: "/mypage/settings", label: "다시 시도" }}
      />
    );

  return (
    <>
      <section className="space-y-3" aria-labelledby="visibility-heading">
        <h2 id="visibility-heading" className="text-xl font-bold">
          프로필 공개 범위
        </h2>
        <Card className="space-y-4">
          <ProfileVisibility
            userId={userId}
            isPublic={profile.data.is_public}
          />
          <div className="legal-table">
            <table>
              <thead>
                <tr>
                  <th scope="col">다른 회원에게</th>
                  <th scope="col">공개</th>
                  <th scope="col">비공개</th>
                </tr>
              </thead>
              <tbody>
                {SHOWN.map(([item, open, closed]) => (
                  <tr key={item}>
                    <td>{item}</td>
                    <td>{open}</td>
                    <td>{closed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="posts-heading">
        <h2 id="posts-heading" className="text-xl font-bold">
          글별 공개 범위
        </h2>
        <Card className="space-y-3">
          <p>
            차 칼럼과 독서기록은 글마다 공개 여부를 정할 수 있어요. 새 글은
            비공개로 시작하고, 글을 쓰거나 수정할 때 바꿀 수 있어요.
          </p>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-ink-muted">공개한 차 칼럼</dt>
              <dd className="text-xl font-bold tabular-nums">
                {publicColumns.count ?? 0} / {columns.count ?? 0}편
              </dd>
              <Link
                href="/me/columns"
                className="text-sm font-bold underline underline-offset-4"
              >
                내 차칼럼
              </Link>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">공개한 독서기록</dt>
              <dd className="text-xl font-bold tabular-nums">
                {publicLogs.count ?? 0} / {logs.count ?? 0}편
              </dd>
              <Link
                href="/me/reading"
                className="text-sm font-bold underline underline-offset-4"
              >
                내 서재
              </Link>
            </div>
          </dl>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="always-heading">
        <h2 id="always-heading" className="text-xl font-bold">
          공개 범위와 상관없이 보이는 정보
        </h2>
        <Card>
          <ul className="list-disc space-y-1 pl-5">
            <li>게시판에 쓴 글과 댓글, 작성자 닉네임과 프로필 사진</li>
            <li>참여 중인 모임의 멤버 목록과 단체 채팅</li>
            <li>1:1 대화 상대에게 보내는 메시지</li>
            <li>
              찻집에 입장했을 때의 닉네임, 캐릭터, 찻집에서 맺은 모임 이름
            </li>
            <li>친구에게 보이는 접속 중 여부와 오늘의 독서·다도 시간</li>
          </ul>
        </Card>
      </section>
    </>
  );
}
