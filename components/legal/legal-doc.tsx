import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

// 이용약관·개인정보처리방침 공통 틀: 제목, 시행일, 목차, 조항
export function LegalDoc({
  title,
  intro,
  sections,
  other,
}: {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-8 py-8 md:py-12">
      <header className="flex flex-col gap-3 border-b-2 border-ink pb-6">
        <p className="text-sm font-bold text-ink-muted">{LEGAL.serviceName}</p>
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        <p className="text-sm text-ink-muted">시행일: {LEGAL.effectiveDate}</p>
        <div className="leading-relaxed">{intro}</div>
      </header>

      <nav
        aria-label="목차"
        className="rounded-lg border-2 border-ink bg-surface p-5 shadow-hard-sm"
      >
        <h2 className="mb-3 font-bold">목차</h2>
        <ol className="grid gap-1.5 text-sm md:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="hover:underline">
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="legal-prose flex flex-col gap-8">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-20">
            <h2 className="mb-3 text-xl font-bold">
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </div>

      <footer className="flex flex-wrap gap-4 border-t-2 border-ink pt-6 text-sm">
        <Link href={other.href} className="font-bold underline">
          {other.label}
        </Link>
        <Link href="/" className="text-ink-muted underline">
          처음으로
        </Link>
      </footer>
    </article>
  );
}
