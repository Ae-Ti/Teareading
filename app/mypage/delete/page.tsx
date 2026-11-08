import Link from "next/link";
import { Suspense } from "react";
import { DeleteAccountForm } from "@/components/profile/delete-account-form";
import { Card } from "@/components/ui/card";
import { LoadingBlock } from "@/components/ui/state";
import { requireUser } from "@/lib/supabase/user";

export const metadata = { title: "회원 탈퇴 · 티어리딩" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8 md:py-10">
      <Link
        href="/mypage"
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 마이페이지
      </Link>
      <h1 className="text-3xl font-bold">회원 탈퇴</h1>
      <Suspense fallback={<LoadingBlock className="h-80" />}>
        <DeleteAccount />
      </Suspense>
    </div>
  );
}

async function DeleteAccount() {
  const { supabase, userId } = await requireUser("/mypage/delete");
  // 모임장인 모임은 함께 지워지므로 미리 알려 준다
  const { data: owned } = await supabase
    .from("groups")
    .select("id, name")
    .eq("owner_id", userId)
    .order("created_at");

  return (
    <Card className="flex flex-col gap-5 border-danger">
      <div className="flex flex-col gap-2">
        <p className="font-bold">
          탈퇴하면 아래 정보가 모두 지워지고 되돌릴 수 없어요.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-muted">
          <li>계정(이메일·비밀번호), 닉네임, 한 줄 소개, 프로필 이미지</li>
          <li>타이머·출석 기록, 독서기록, 차 칼럼</li>
          <li>내가 보낸 단체 채팅·1:1 메시지와 1:1 대화방</li>
          <li>게시판에 쓴 글·댓글과 추천</li>
          <li>모임 가입 정보, 차단 목록, 찻집 기록과 캐릭터</li>
        </ul>
      </div>
      {owned && owned.length > 0 && (
        <div
          role="note"
          className="rounded-md border-2 border-danger bg-danger-soft p-4 text-sm"
        >
          <p className="font-bold">
            내가 모임장인 모임 {owned.length}개도 함께 삭제돼요.
          </p>
          <p className="mt-1 text-ink-muted">
            멤버들의 단체 채팅 기록도 함께 사라져요:{" "}
            {owned.map((g) => g.name).join(", ")}
          </p>
        </div>
      )}
      <DeleteAccountForm />
    </Card>
  );
}
