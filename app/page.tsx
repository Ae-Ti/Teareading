import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { listGuides } from "@/lib/guide";

export const metadata = {
  title: "티어리딩 · 차 한 잔, 책 한 권의 시간",
  description:
    "다도와 독서 시간을 타이머로 재고, 기록하고, 같은 취향의 사람들과 나누는 공간.",
};

// 비로그인 랜딩. 로그인 상태로 `/`에 오면 proxy가 /dashboard로 보낸다(깜박임 없이 서버에서).
export default async function Page() {
  const guides = (await listGuides()).slice(0, 3);

  return (
    <div className="flex flex-col gap-16 py-10 md:gap-24 md:py-16">
      <Hero />
      <Features />
      <Steps />
      <section aria-labelledby="guide-heading" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Badge tone="yuja" className="self-start">
              로그인 없이 읽기
            </Badge>
            <h2 id="guide-heading" className="text-2xl font-bold md:text-3xl">
              다도가 처음이라면
            </h2>
          </div>
          <Link href="/guide" className="text-sm font-bold underline">
            가이드 전체 보기
          </Link>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={`/guide/${g.slug}`} className="block h-full">
                <Card className="flex h-full flex-col gap-2 shadow-hard-sm transition hover:-translate-y-px hover:shadow-hard">
                  <span className="text-xs text-ink-muted">
                    {g.minutes}분 읽기
                  </span>
                  <span className="font-bold">{g.title}</span>
                  <span className="text-sm text-ink-muted">{g.summary}</span>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <Cta />
    </div>
  );
}

function Hero() {
  return (
    <section className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
      <div className="flex flex-col gap-6">
        <Badge tone="matcha" className="self-start">
          다도 · 독서 타이머
        </Badge>
        <h1 className="text-4xl leading-tight font-extrabold md:text-6xl">
          차 한 잔,
          <br />책 한 권의 시간.
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-ink-muted">
          티어리딩은 차를 우리고 책을 읽는 시간을 타이머로 재고, 오늘의 문장을
          기록하고, 같은 취향의 사람들과 나누는 곳이에요.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/signup" size="lg">
            무료로 시작하기
          </LinkButton>
          <LinkButton href="/login" size="lg" variant="secondary">
            로그인
          </LinkButton>
        </div>
      </div>
      <TimerPreview />
    </section>
  );
}

// 실제 타이머 화면을 단순화한 그림. 움직이지 않는 장식이라 스크린리더에서는 숨긴다.
function TimerPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-sm">
      <Card
        tone="hojicha"
        className="absolute -top-4 -right-2 rotate-3 px-4 py-2 shadow-hard-sm"
      >
        <span className="text-sm font-bold">🍵 우전 녹차 · 2분</span>
      </Card>
      <Card className="flex flex-col items-center gap-5 p-8 shadow-hard-lg">
        <div className="flex gap-2">
          <span className="rounded-sm border-2 border-ink bg-matcha px-2 py-0.5 text-xs font-bold">
            다도
          </span>
          <span className="rounded-sm border-2 border-ink px-2 py-0.5 text-xs font-bold">
            독서
          </span>
        </div>
        <div className="flex size-44 items-center justify-center rounded-full border-[6px] border-ink bg-[conic-gradient(var(--tr-matcha)_0_62%,var(--tr-surface-sunken)_62%_100%)]">
          <div className="flex size-32 flex-col items-center justify-center rounded-full border-2 border-ink bg-surface">
            <span className="font-mono text-3xl font-extrabold tabular-nums">
              15:32
            </span>
            <span className="text-xs text-ink-muted">25분 중</span>
          </div>
        </div>
        <div className="flex w-full justify-between text-sm">
          <span className="font-bold">이번 주 출석</span>
          <span className="flex gap-1">
            {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => (
              <span
                key={d}
                className={`flex size-6 items-center justify-center rounded-full border-2 border-ink text-[10px] font-bold ${i < 4 ? "bg-matcha" : "bg-surface"}`}
              >
                {d}
              </span>
            ))}
          </span>
        </div>
      </Card>
      <Card
        tone="hongcha"
        className="absolute -bottom-5 -left-3 -rotate-2 px-4 py-2 shadow-hard-sm"
      >
        <span className="text-sm font-bold">📖 오늘의 문장 기록</span>
      </Card>
    </div>
  );
}

const FEATURES = [
  {
    accent: "bg-matcha",
    title: "다도·독서 타이머",
    body: "15·25·45·60분이나 원하는 시간으로 시작해요. 새로고침하거나 다른 기기에서 열어도 그대로 이어지고, 다 마치면 그날 출석이 채워져요.",
  },
  {
    accent: "bg-hongcha",
    title: "나만 보는 기록장",
    body: "읽은 책의 문장, 마신 차의 향과 맛을 독서기록·차 칼럼으로 남겨요. 기록은 나에게만 보여요.",
  },
  {
    accent: "bg-yuja",
    title: "함께 몰입하는 찻집",
    body: "픽셀 찻집에 들어가면 지금 차를 마시거나 책을 읽는 사람들이 보여요. 혼자여도, 함께여도 좋아요.",
  },
  {
    accent: "bg-hojicha",
    title: "모임과 메시지",
    body: "관심사가 맞는 모임에 들어가 단체 채팅을 나누고, 모임에서 만난 사람과 1:1로 이야기해요.",
  },
] as const;

function Features() {
  return (
    <section aria-labelledby="features-heading" className="flex flex-col gap-6">
      <h2 id="features-heading" className="text-2xl font-bold md:text-3xl">
        티어리딩에서 할 수 있는 것
      </h2>
      <ul className="grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <Card className="flex h-full flex-col gap-3">
              <span
                aria-hidden
                className={`h-2 w-12 rounded-full border-2 border-ink ${f.accent}`}
              />
              <h3 className="text-lg font-bold">{f.title}</h3>
              <p className="leading-relaxed text-ink-muted">{f.body}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Steps() {
  const steps = [
    ["차와 책 고르기", "오늘 우릴 차와 읽을 책을 준비해요."],
    ["타이머 시작", "다도인지 독서인지 고르고 시간을 정해요."],
    ["기록하고 출석", "끝나면 한 줄을 남기고 출석이 쌓여요."],
  ];
  return (
    <section aria-labelledby="steps-heading" className="flex flex-col gap-6">
      <h2 id="steps-heading" className="text-2xl font-bold md:text-3xl">
        하루 25분이면 충분해요
      </h2>
      <ol className="grid gap-4 md:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li
            key={title}
            className="flex gap-4 rounded-lg border-2 border-dashed border-ink-subtle p-5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-yuja font-mono font-extrabold">
              {i + 1}
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-bold">{title}</span>
              <span className="text-sm text-ink-muted">{body}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Cta() {
  return (
    <Card
      tone="matcha"
      className="flex flex-col items-start gap-4 p-8 md:flex-row md:items-center md:justify-between md:p-10"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold md:text-3xl">
          오늘의 첫 잔을 우려 볼까요?
        </h2>
        <p className="text-ink">가입은 이메일로 1분이면 끝나요.</p>
      </div>
      <LinkButton href="/signup" size="lg" variant="secondary">
        무료로 시작하기
      </LinkButton>
    </Card>
  );
}
