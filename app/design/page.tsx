import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

// 디자인 시스템 시안 확인용 페이지. 확정되면 삭제하거나 개발 환경 전용으로 돌린다.
export const metadata = { title: "디자인 시안 · 티어리딩" };

const COLORS = [
  { name: "canvas", label: "한지", hex: "#f6f3ea", cls: "bg-canvas" },
  { name: "surface", label: "바탕", hex: "#ffffff", cls: "bg-surface" },
  { name: "ink", label: "먹", hex: "#1f1d17", cls: "bg-ink" },
  { name: "matcha", label: "말차 · 주 색", hex: "#b5d99c", cls: "bg-matcha" },
  { name: "hojicha", label: "호지차", hex: "#d9a47a", cls: "bg-hojicha" },
  { name: "hongcha", label: "홍차", hex: "#f1b9a8", cls: "bg-hongcha" },
  { name: "yuja", label: "유자 · 하이라이트", hex: "#f5d76e", cls: "bg-yuja" },
  { name: "danger", label: "오류", hex: "#c8452f", cls: "bg-danger" },
];

const TYPE = [
  {
    cls: "font-mono text-5xl font-extrabold tracking-tight",
    label: "Display 48 · mono 800",
    text: "차 한 잔, 책 한 장",
  },
  {
    cls: "font-mono text-3xl font-bold tracking-tight",
    label: "H1 30 · mono 700",
    text: "오늘의 타이머 25:00",
  },
  {
    cls: "font-mono text-xl font-bold",
    label: "H2 20 · mono 700",
    text: "독서기록 · Reading Log",
  },
  {
    cls: "text-base",
    label: "Body 16 · sans 400",
    text: "차를 우리는 3분 동안 마음을 가라앉히고, 이어서 25분 동안 책에 집중합니다.",
  },
  {
    cls: "text-sm text-ink-muted",
    label: "Caption 14 · sans 400",
    text: "2026년 11월 7일 · 연속 출석 4일째",
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-t-2 border-ink pt-8">
      <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-ink-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <div data-heading="sans" className="flex flex-col gap-12 py-10">
      {/* 히어로 */}
      <header className="flex flex-col gap-4">
        <Badge tone="yuja" className="self-start">
          Design system v0 · 시안
        </Badge>
        <h1 className="font-mono text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
          차를 마시는 시간,
          <br />
          <span className="bg-matcha px-2 shadow-hard-sm">책을 읽는 시간.</span>
        </h1>
        <p className="max-w-xl text-lg text-ink-muted">
          한지색 바탕 위에 먹선 테두리와 각진 그림자. 제목은 고정폭, 본문은 읽기
          편한 고딕.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg">타이머 시작하기</Button>
          <Button size="lg" variant="secondary">
            다도 가이드 보기
          </Button>
        </div>
      </header>

      <Section title="Color">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {COLORS.map((c) => (
            <div
              key={c.name}
              className="overflow-hidden rounded-md border-2 border-ink bg-surface shadow-hard-sm"
            >
              <div className={`h-20 border-b-2 border-ink ${c.cls}`} />
              <div className="p-3">
                <p className="font-mono text-sm font-bold">{c.label}</p>
                <p className="font-mono text-xs text-ink-muted">
                  {c.name} · {c.hex}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="flex flex-col gap-5">
          {TYPE.map((t) => (
            <div key={t.label} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-ink-subtle">
                {t.label}
              </span>
              <p className={t.cls}>{t.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>기본</Button>
          <Button variant="secondary">보조</Button>
          <Button variant="ghost">텍스트</Button>
          <Button variant="danger">삭제</Button>
          <Button loading>저장 중</Button>
          <Button disabled>비활성</Button>
          <Button size="sm">작게</Button>
        </div>
      </Section>

      <Section title="Inputs & Badges">
        <div className="grid gap-5 md:grid-cols-3">
          <Input
            label="닉네임"
            placeholder="2~20자"
            hint="다른 이용자에게 보이는 이름이에요."
          />
          <Input
            label="이메일"
            defaultValue="tea@reading"
            error="이메일 형식이 올바르지 않아요."
          />
          <Input label="비활성" defaultValue="수정할 수 없음" disabled />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>기본</Badge>
          <Badge tone="matcha">다도</Badge>
          <Badge tone="hongcha">독서</Badge>
          <Badge tone="yuja">출석</Badge>
          <Badge tone="danger">실패</Badge>
        </div>
      </Section>

      <Section title="예시 화면 · 타이머 대시보드">
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <Card tone="matcha" className="flex flex-col gap-6 p-6 md:p-8">
            <div className="flex items-center justify-between">
              <Badge>진행 중 · 다도</Badge>
              <span className="font-mono text-sm font-bold">목표 25분</span>
            </div>
            <p className="font-mono text-7xl font-extrabold tracking-tighter md:text-8xl">
              18:42
            </p>
            <div className="h-4 overflow-hidden rounded-sm border-2 border-ink bg-surface">
              <div className="h-full w-[25%] border-r-2 border-ink bg-ink" />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary">완료</Button>
              <Button variant="ghost">중단</Button>
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-lg font-bold">이번 주 출석</h3>
                <Badge tone="yuja">4일 연속</Badge>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {["월", "화", "수", "목", "금", "토", "일"].map((d, i) => (
                  <div key={d} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-ink-muted">{d}</span>
                    <span
                      className={`size-8 rounded-sm border-2 border-ink ${i >= 1 && i <= 4 ? "bg-matcha" : "bg-sunken"}`}
                    />
                  </div>
                ))}
              </div>
            </Card>
            <Card tone="hongcha" className="flex flex-col gap-2">
              <h3 className="font-mono text-lg font-bold">
                찻집에 3명이 있어요
              </h3>
              <div className="flex -space-x-2">
                {["차", "책", "윤"].map((n) => (
                  <span
                    key={n}
                    className="flex size-10 items-center justify-center rounded-full border-2 border-ink bg-surface font-mono font-bold"
                  >
                    {n}
                  </span>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-2 self-start">
                찻집 입장
              </Button>
            </Card>
          </div>
        </div>
      </Section>

      <Section title="예시 화면 · 기록 목록과 채팅">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            {[
              { t: "데미안", d: "새는 알에서 나오려고 투쟁한다…", tag: "독서" },
              {
                t: "우전 녹차 첫물",
                d: "70도 물에 2분. 풋풋한 향이…",
                tag: "차 칼럼",
              },
            ].map((r) => (
              <Card
                key={r.t}
                className="flex flex-col gap-1 p-4 shadow-hard-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-mono font-bold">{r.t}</h3>
                  <Badge tone={r.tag === "독서" ? "hongcha" : "matcha"}>
                    {r.tag}
                  </Badge>
                </div>
                <p className="text-sm text-ink-muted">{r.d}</p>
              </Card>
            ))}
            <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-ink-subtle p-8 text-center">
              <p className="font-mono font-bold">아직 쓴 기록이 없어요</p>
              <p className="text-sm text-ink-muted">
                타이머를 마친 뒤 오늘 읽은 내용을 남겨 보세요.
              </p>
              <Button size="sm">첫 기록 쓰기</Button>
            </div>
          </div>

          <Card className="flex flex-col gap-3 p-4">
            <h3 className="border-b-2 border-ink pb-3 font-mono font-bold">
              새벽 독서 모임 · 단체 채팅
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <p className="self-start rounded-md border-2 border-ink bg-sunken px-3 py-2">
                오늘은 보이차 우리면서 읽어요 ☕
              </p>
              <p className="self-end rounded-md border-2 border-ink bg-matcha px-3 py-2">
                저도 지금 타이머 켰어요!
              </p>
              <p className="flex items-center gap-2 self-end rounded-md border-2 border-danger bg-danger-soft px-3 py-2">
                25분 뒤에 후기 공유해요
                <span className="font-mono text-xs font-bold text-danger">
                  전송 실패 · 재시도
                </span>
              </p>
            </div>
            <div className="flex gap-2 border-t-2 border-ink pt-3">
              <input
                aria-label="메시지 입력"
                placeholder="메시지 입력"
                className="h-10 flex-1 rounded-md border-2 border-ink px-3 focus:shadow-hard-sm focus:outline-none"
              />
              <Button size="sm">전송</Button>
            </div>
          </Card>
        </div>
      </Section>
    </div>
  );
}
