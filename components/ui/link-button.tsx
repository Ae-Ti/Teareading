import Link from "next/link";
import { cn } from "./cn";

const VARIANTS = {
  primary: "bg-matcha shadow-hard",
  secondary: "bg-surface shadow-hard",
  ghost: "border-transparent hover:bg-sunken",
} as const;

const SIZES = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
} as const;

// 화면 이동용 버튼 모양 링크
export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
}) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border-2 border-ink font-bold text-ink transition hover:-translate-x-px hover:-translate-y-px",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
