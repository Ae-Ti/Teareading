import { LinkButton } from "@/components/ui/link-button";

export const metadata = { title: "탈퇴 완료 · 티어리딩" };

export default function Page() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-5 py-20 text-center">
      <span aria-hidden className="text-5xl">
        🍵
      </span>
      <h1 className="text-2xl font-bold md:text-3xl">탈퇴가 완료됐어요</h1>
      <p className="leading-relaxed text-ink-muted">
        계정과 기록을 모두 지웠어요. 그동안 티어리딩에서 함께 차를 마시고 책을
        읽어 주셔서 고마워요.
      </p>
      <LinkButton href="/" variant="secondary">
        처음으로
      </LinkButton>
    </div>
  );
}
