import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-matcha text-ink border-ink shadow-hard",
  secondary: "bg-surface text-ink border-ink shadow-hard",
  ghost:
    "bg-transparent text-ink border-transparent shadow-none hover:bg-sunken",
  danger: "bg-danger text-white border-ink shadow-hard",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border-2 font-bold transition",
        "enabled:hover:-translate-x-px enabled:hover:-translate-y-px enabled:active:translate-x-0.5 enabled:active:translate-y-0.5 enabled:active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
