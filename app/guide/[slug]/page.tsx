import Link from "next/link";
import { Suspense } from "react";
import { TrackView } from "@/components/track-view";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/link-button";
import { LoadingBlock, StateMessage } from "@/components/ui/state";
import { getGuide, listGuides } from "@/lib/guide";

export async function generateStaticParams() {
  return (await listGuides()).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata(props: PageProps<"/guide/[slug]">) {
  const guide = await getGuide((await props.params).slug);
  return guide
    ? {
        title: `${guide.meta.title} · 다도 입문 가이드`,
        description: guide.meta.summary,
      }
    : { title: "가이드를 찾을 수 없어요 · 티어리딩" };
}

export default function Page(props: PageProps<"/guide/[slug]">) {
  return (
    <Suspense
      fallback={<LoadingBlock className="mx-auto my-10 h-96 max-w-3xl" />}
    >
      <Guide params={props.params} />
    </Suspense>
  );
}

async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, all] = await Promise.all([getGuide(slug), listGuides()]);

  if (!guide) {
    return (
      <div className="py-10">
        <StateMessage
          title="가이드를 찾을 수 없어요"
          description="주소가 바뀌었거나 없는 가이드예요."
          action={{ href: "/guide", label: "가이드 목록" }}
        />
      </div>
    );
  }

  const index = all.findIndex((g) => g.slug === slug);
  const next = all[index + 1];

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 md:py-10">
      <TrackView name="guide_viewed" props={{ slug }} />
      <Link
        href="/guide"
        className="text-sm font-bold text-ink-muted hover:text-ink"
      >
        ← 다도 입문 가이드
      </Link>
      <header className="flex flex-col gap-3">
        <Badge tone="yuja" className="self-start">
          입문 · <span className="font-mono">{guide.meta.minutes}</span>분
        </Badge>
        <h1 className="text-2xl font-bold md:text-4xl">{guide.meta.title}</h1>
        <p className="text-lg text-ink-muted">{guide.meta.summary}</p>
      </header>

      <div
        className="guide-prose"
        dangerouslySetInnerHTML={{ __html: guide.html }}
      />

      <div className="flex flex-wrap gap-3 border-t-2 border-ink pt-6">
        <LinkButton href="/dashboard">다도 타이머 켜기</LinkButton>
        {next && (
          <LinkButton href={`/guide/${next.slug}`} variant="secondary">
            다음: {next.title}
          </LinkButton>
        )}
      </div>
    </article>
  );
}
