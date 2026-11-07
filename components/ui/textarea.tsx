"use client";

import { useId } from "react";
import { cn } from "./cn";

export function Textarea({
  label,
  hint,
  error,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
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
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-40 rounded-md border-2 border-ink bg-surface p-3 text-base leading-relaxed placeholder:text-ink-subtle",
          "focus:shadow-hard-sm focus:outline-none",
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
