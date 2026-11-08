import { SpriteSheet } from "./sprite-sheet";

// 찻집 캐릭터 도트 시안 확인용 (디자인 시안 페이지와 같은 용도)
export const metadata = { title: "찻집 캐릭터 시안 · 티어리딩" };

export default function Page() {
  return (
    <div className="flex flex-col gap-4 overflow-x-auto py-8">
      <h1 className="text-2xl font-bold">찻집 캐릭터 시안</h1>
      <p className="text-sm text-ink-muted">
        방향(아래·왼쪽·위·오른쪽) × 자세(서기·걷기 2·앉기). 위 4줄은 머리 모양,
        아래 3줄은 머리 장식.
      </p>
      <SpriteSheet />
    </div>
  );
}
