import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StateMessage } from "@/components/ui/state";
import { listGuides } from "@/lib/guide";

export const metadata = {
  title: "다도 입문 가이드 · 티어리딩",
  description:
    "차의 종류, 다구, 우리는 법, 물 온도, 예절까지. 다도를 처음 시작하는 분을 위한 안내.",
};

// 로그인 없이 볼 수 있다 (명세 4.1)
export default async function Page() {
  const guides = await listGuides();

  return (
    <div className="flex flex-col gap-6 py-6 md:py-10">
      <div className="flex flex-col gap-2">
        <Badge tone="yuja" className="self-start">
          입문자용
        </Badge>
        <h1 className="text-2xl font-bold md:text-4xl">다도 입문 가이드</h1>
        <p className="max-w-2xl text-ink-muted">
          차를 처음 우려 보는 분을 위한 기본 안내예요. 순서대로 읽어도 좋고,
          궁금한 것부터 골라 읽어도 좋아요.
        </p>
      </div>

      {guides.length === 0 ? (
        <StateMessage
          title="아직 준비된 가이드가 없어요"
          description="곧 첫 가이드를 올릴게요."
        />
      ) : (
        <ol className="grid gap-4 md:grid-cols-2">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={`/guide/${g.slug}`} className="block h-full">
                <Card className="flex h-full flex-col gap-2 p-5 shadow-hard-sm transition hover:-translate-y-px hover:shadow-hard">
                  <span className="font-mono text-sm font-bold text-ink-muted">
                    {String(g.order).padStart(2, "0")}
                  </span>
                  <h2 className="text-lg font-bold">{g.title}</h2>
                  <p className="text-sm text-ink-muted">{g.summary}</p>
                  <p className="mt-auto text-xs text-ink-subtle">
                    읽는 데 <span className="font-mono">{g.minutes}</span>분
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
