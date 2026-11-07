import { cn } from "@/components/ui/cn";

// 프로필 이미지가 없으면 닉네임 첫 글자. 웅싯의 Avatar 컴포넌트가 나오면 교체한다.
export function MiniAvatar({
  nickname,
  src,
  className,
}: {
  nickname: string;
  src?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-yuja font-bold",
        className,
      )}
      aria-hidden
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        nickname.slice(0, 1)
      )}
    </span>
  );
}
