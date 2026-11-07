"use client";

import { useId } from "react";
import { cn } from "./cn";

export function Input({
  label,
  hint,
  error,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-11 rounded-md border-2 border-ink bg-surface px-3 text-base placeholder:text-ink-subtle",
          "focus:shadow-hard-sm focus:outline-none disabled:bg-sunken disabled:text-ink-subtle",
          error && "border-danger bg-danger-soft",
          className,
        )}
        {...props}
      />
      {(error || hint) && (
        <p
          id={describedBy}
          className={cn("text-sm", error ? "text-danger" : "text-ink-muted")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
