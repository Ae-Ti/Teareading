// D1 임시 화면. 각 담당자가 기능을 구현하면서 교체한다.
export function ComingSoon({
  title,
  owner,
  day,
}: {
  title: string;
  owner: "웅싯" | "태일";
  day: string;
}) {
  return (
    <section className="flex flex-col gap-2 py-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-sm text-ink-muted">
        준비 중 · 담당 {owner} · {day}
      </p>
    </section>
  );
}
