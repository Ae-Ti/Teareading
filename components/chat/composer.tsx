"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { MESSAGE_MAX, countChars, normalizeBody } from "@/lib/chat/core";

// 메시지 입력창. 데스크톱은 Enter로 보내고 Shift+Enter로 줄을 바꾼다.
// 한글 조합 중 Enter는 보내지 않는다. 터치 기기는 Enter가 줄바꿈이고 버튼으로 보낸다.
export function Composer({
  onSend,
  placeholder,
  disabledReason,
}: {
  onSend: (body: string) => void;
  placeholder: string;
  disabledReason?: string | null;
}) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const length = countChars(value);
  const disabled = Boolean(disabledReason);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    if (disabled) return;
    const result = normalizeBody(value);
    if (result.error) {
      setError(value.trim() ? result.error : null);
      return;
    }
    setError(null);
    setValue("");
    onSend(result.body);
    ref.current?.focus();
  };

  return (
    <form
      className="flex flex-col gap-1.5 border-t-2 border-ink bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex items-end gap-2">
        <label htmlFor={id} className="sr-only">
          메시지 입력
        </label>
        <textarea
          id={id}
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={disabledReason ?? placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (
              e.key !== "Enter" ||
              e.shiftKey ||
              e.nativeEvent.isComposing ||
              e.keyCode === 229
            )
              return;
            if (window.matchMedia("(pointer: coarse)").matches) return;
            e.preventDefault();
            submit();
          }}
          className={cn(
            "max-h-40 min-h-11 flex-1 resize-none rounded-md border-2 border-ink bg-surface px-3 py-2 text-base leading-relaxed placeholder:text-ink-subtle",
            "focus:shadow-hard-sm focus:outline-none disabled:bg-sunken",
            error && "border-danger bg-danger-soft",
          )}
        />
        <Button type="submit" disabled={disabled || !value.trim()}>
          보내기
        </Button>
      </div>
      {(error || length > MESSAGE_MAX - 100) && (
        <p
          id={`${id}-error`}
          role={error ? "alert" : undefined}
          className={cn(
            "text-xs",
            error || length > MESSAGE_MAX ? "text-danger" : "text-ink-muted",
          )}
        >
          {error ??
            `${length.toLocaleString()} / ${MESSAGE_MAX.toLocaleString()}자`}
        </p>
      )}
    </form>
  );
}
