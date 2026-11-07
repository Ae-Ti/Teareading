import { cn } from "./cn";

export function Card({
  tone = "surface",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "surface" | "matcha" | "hojicha" | "hongcha" | "yuja";
}) {
  const tones = {
    surface: "bg-surface",
    matcha: "bg-matcha",
    hojicha: "bg-hojicha",
    hongcha: "bg-hongcha",
    yuja: "bg-yuja",
  } as const;

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-ink p-5 shadow-hard",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
