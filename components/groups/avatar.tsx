import { ProfileAvatar } from "@/components/profile/avatar";

// 모임·찻집에서도 같은 아바타 검증과 이미지 실패 시 대체 표시를 쓴다.
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
    <ProfileAvatar
      nickname={nickname}
      src={src}
      size="sm"
      className={className}
    />
  );
}
