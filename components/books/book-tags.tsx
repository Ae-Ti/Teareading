import { cn } from "@/components/ui/cn";
import { GENRES, type Genre } from "@/lib/books";

const TONES = ["bg-matcha/60", "bg-yuja/60", "bg-hongcha/60", "bg-hojicha/50"];
const KEYS = Object.keys(GENRES) as Genre[];

// 같은 장르는 어디서나 같은 색 태그로 보인다
export const genreTone = (genre: Genre) =>
  TONES[KEYS.indexOf(genre) % TONES.length];

export function GenreTags({
  genres,
  className,
}: {
  genres: Genre[];
  className?: string;
}) {
  if (!genres.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1", className)}>
      {genres.map((g) => (
        <li
          key={g}
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap",
            genreTone(g),
          )}
        >
          {GENRES[g]}
        </li>
      ))}
    </ul>
  );
}
