import { cn } from "./cn";

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "matcha" | "yuja" | "hongcha" | "danger";
}) {
  const tones = {
    neutral: "bg-surface",
    matcha: "bg-matcha",
    yuja: "bg-yuja",
    hongcha: "bg-hongcha",
    danger: "bg-danger text-white",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border-2 border-ink px-2 py-0.5 text-xs font-bold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
