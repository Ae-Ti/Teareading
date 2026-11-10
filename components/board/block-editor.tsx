"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { uploadPostImage } from "@/app/board/actions";
import { Button } from "@/components/ui/button";
import { BODY_MAX, POST_IMAGE_MAX, type PostBlock } from "@/lib/board";

type EditorBlock =
  | { key: string; type: "text"; text: string }
  | { key: string; type: "image"; url: string }
  | { key: string; type: "uploading" };

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

// 배포 환경의 요청 크기 제한(약 4.5MB)에 걸리지 않게, 올리기 전에 브라우저에서 줄인다.
// 서버는 받은 사진을 다시 인코딩한다 (lib/profile/image.ts).
const SHRINK_EDGE = 1600;
const SHRINK_OVER = 3 * 1024 * 1024;
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      SHRINK_EDGE / Math.max(bitmap.width, bitmap.height),
    );
    if (scale === 1 && file.size <= SHRINK_OVER) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")!
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.9),
    );
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size)
      return file;
    return new File([blob], "photo.webp", { type: "image/webp" });
  } catch {
    // 브라우저가 읽지 못하는 사진은 그대로 보내고 서버 검사에 맡긴다
    return file;
  }
}

let seq = 0;
const newKey = () => `block-${++seq}`;
const textBlock = (text = ""): EditorBlock => ({
  key: newKey(),
  type: "text",
  text,
});

// 항상 맨 앞·맨 뒤·사진 사이에 글 칸을 둬서 어디든 글을 쓸 수 있게 한다
function normalize(blocks: EditorBlock[]) {
  const out: EditorBlock[] = [];
  for (const block of blocks) {
    const last = out.at(-1);
    if (block.type === "text" && last?.type === "text") {
      out[out.length - 1] = {
        ...last,
        text: [last.text, block.text].filter(Boolean).join("\n"),
      };
      continue;
    }
    if (block.type !== "text" && last?.type !== "text") out.push(textBlock());
    out.push(block);
  }
  if (out.at(-1)?.type !== "text") out.push(textBlock());
  return out;
}

function toBlocks(editor: EditorBlock[]): PostBlock[] {
  return editor.flatMap((b): PostBlock[] => {
    if (b.type === "image") return [{ type: "image", url: b.url }];
    if (b.type === "text" && b.text.trim())
      return [{ type: "text", text: b.text }];
    return [];
  });
}

// 내용 길이에 맞춰 늘어나는 글 칸
function GrowingTextarea(props: React.ComponentProps<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} />;
}

// 블로그처럼 글과 사진을 원하는 자리에 넣는 편집기. 커서가 있던 자리에서 글을 나눠 사진을 넣는다.
export function BlockEditor({
  initial,
  error,
  onDirty,
  onUploadingChange,
}: {
  initial: PostBlock[];
  error?: string;
  onDirty: () => void;
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [blocks, setBlocks] = useState<EditorBlock[]>(() =>
    normalize(
      initial.map((b) =>
        b.type === "text"
          ? { key: newKey(), type: "text", text: b.text }
          : { key: newKey(), type: "image", url: b.url },
      ),
    ),
  );
  const [notice, setNotice] = useState<string | null>(null);
  // 마지막으로 글을 쓰던 칸. 칸에서 벗어나도 커서 위치는 칸이 기억하고 있다
  const caret = useRef<{
    key: string;
    pos: number;
    el?: HTMLTextAreaElement;
  } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const imageCount = blocks.filter((b) => b.type !== "text").length;
  const length = blocks.reduce(
    (n, b) => n + (b.type === "text" ? [...b.text].length : 0),
    0,
  );
  const uploading = blocks.some((b) => b.type === "uploading");
  const nonEmpty = blocks.filter((b) => b.type !== "text" || b.text.trim());

  const saveCaret = (key: string, el: HTMLTextAreaElement) => {
    caret.current = { key, pos: el.selectionStart, el };
  };

  const insertFiles = async (picked: File[]) => {
    const files = picked.filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const bad = files.find(
      (f) => !TYPES.includes(f.type) || f.size > MAX_BYTES,
    );
    if (bad) {
      setNotice("사진은 5MB 이하의 JPG, PNG, WebP만 넣을 수 있어요.");
      return;
    }
    if (imageCount + files.length > POST_IMAGE_MAX) {
      setNotice(`사진은 ${POST_IMAGE_MAX}장까지 넣을 수 있어요.`);
      return;
    }
    setNotice(null);
    onDirty();
    onUploadingChange(true);

    const holders = files.map((): EditorBlock => ({
      key: newKey(),
      type: "uploading",
    }));
    const afterKey = newKey();
    const saved = caret.current;
    const at = saved && {
      key: saved.key,
      pos: saved.el?.isConnected ? saved.el.selectionStart : saved.pos,
    };
    setBlocks((current) => {
      let index = current.findIndex(
        (b) => b.key === at?.key && b.type === "text",
      );
      if (index < 0) index = current.length - 1;
      const block = current[index];
      if (block.type !== "text") return current;
      const pos = at?.key === block.key ? at.pos : block.text.length;
      return normalize([
        ...current.slice(0, index),
        { ...block, text: block.text.slice(0, pos).replace(/\n+$/, "") },
        ...holders,
        {
          key: afterKey,
          type: "text",
          text: block.text.slice(pos).replace(/^\n+/, ""),
        },
        ...current.slice(index + 1),
      ]);
    });
    // 이어서 넣는 사진은 방금 넣은 사진 뒤로 들어간다
    caret.current = { key: afterKey, pos: 0 };

    // 서버 액션은 한 번에 하나씩 처리되므로 차례로 올린다
    for (const [i, file] of files.entries()) {
      const form = new FormData();
      form.set("image", await shrinkImage(file));
      let url: string | undefined;
      try {
        const res = await uploadPostImage(form);
        url = res.url;
        if (res.error) setNotice(res.error);
      } catch {
        setNotice("사진을 올리지 못했어요. 다시 시도해 주세요.");
      }
      const holder = holders[i];
      setBlocks((current) =>
        normalize(
          current.flatMap((b): EditorBlock[] =>
            b.key !== holder.key
              ? [b]
              : url
                ? [{ key: b.key, type: "image", url }]
                : [],
          ),
        ),
      );
    }
    onUploadingChange(false);
  };

  const removeBlock = (key: string) => {
    onDirty();
    setBlocks((current) => normalize(current.filter((b) => b.key !== key)));
  };

  // 사진을 앞뒤 내용과 자리를 바꾼다. 빈 글 칸은 건너뛴다
  const moveBlock = (key: string, by: -1 | 1) => {
    onDirty();
    setBlocks((current) => {
      const list = current.filter((b) => b.type !== "text" || b.text.trim());
      const from = list.findIndex((b) => b.key === key);
      const to = from + by;
      if (from < 0 || to < 0 || to >= list.length) return current;
      [list[from], list[to]] = [list[to], list[from]];
      return normalize(list);
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold">내용</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => fileInput.current?.click()}
        >
          사진 넣기
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={TYPES.join(",")}
          aria-label="사진 파일 선택"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            void insertFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>
      <input
        type="hidden"
        name="content"
        value={JSON.stringify(toBlocks(blocks))}
      />
      <div
        className="flex min-h-72 cursor-text flex-col gap-3 rounded-md border-2 border-ink bg-surface p-3 focus-within:shadow-hard-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void insertFiles([...e.dataTransfer.files]);
        }}
      >
        {blocks.map((block, i) => {
          if (block.type === "text") {
            const only = blocks.length === 1;
            return (
              <GrowingTextarea
                key={block.key}
                aria-label={i === 0 ? "내용" : `글 칸 ${i + 1}`}
                aria-invalid={error ? true : undefined}
                value={block.text}
                placeholder={
                  only
                    ? "함께 나누고 싶은 이야기를 적어 주세요. 다른 사람을 배려하는 글을 부탁드려요."
                    : undefined
                }
                onChange={(e) => {
                  const text = e.target.value;
                  saveCaret(block.key, e.target);
                  setBlocks((current) =>
                    current.map((b) =>
                      b.key === block.key ? { ...b, text } : b,
                    ),
                  );
                }}
                onFocus={(e) => saveCaret(block.key, e.currentTarget)}
                onSelect={(e) => saveCaret(block.key, e.currentTarget)}
                onPaste={(e) => {
                  const files = [...e.clipboardData.files];
                  if (!files.some((f) => f.type.startsWith("image/"))) return;
                  e.preventDefault();
                  saveCaret(block.key, e.currentTarget);
                  void insertFiles(files);
                }}
                className="w-full resize-none overflow-hidden bg-transparent leading-relaxed placeholder:text-ink-subtle focus:outline-none"
              />
            );
          }
          if (block.type === "uploading")
            return (
              <div
                key={block.key}
                role="status"
                className="flex h-32 items-center justify-center rounded-md border-2 border-dashed border-ink-subtle text-sm text-ink-muted"
              >
                사진 올리는 중…
              </div>
            );
          const order = nonEmpty.findIndex((b) => b.key === block.key);
          return (
            <figure key={block.key} className="relative self-center">
              {/* 올린 사진은 크기를 미리 알 수 없어 img를 쓴다 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.url}
                alt="글에 넣은 사진"
                className="max-h-96 max-w-full rounded-md border-2 border-ink"
              />
              <div className="absolute top-1.5 right-1.5 flex gap-1">
                {[
                  {
                    label: "사진 위로",
                    icon: "↑",
                    off: order === 0,
                    run: () => moveBlock(block.key, -1),
                  },
                  {
                    label: "사진 아래로",
                    icon: "↓",
                    off: order === nonEmpty.length - 1,
                    run: () => moveBlock(block.key, 1),
                  },
                  {
                    label: "사진 삭제",
                    icon: "✕",
                    off: false,
                    run: () => removeBlock(block.key),
                  },
                ].map((tool) => (
                  <button
                    key={tool.label}
                    type="button"
                    aria-label={tool.label}
                    disabled={tool.off}
                    onClick={tool.run}
                    className="flex size-7 items-center justify-center rounded-sm border-2 border-ink bg-surface text-sm font-bold disabled:cursor-not-allowed disabled:text-ink-subtle"
                  >
                    {tool.icon}
                  </button>
                ))}
              </div>
            </figure>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted">
        커서가 있는 자리에 사진이 들어가요. 붙여넣기와 끌어다 놓기도 돼요.
        <span className="ml-2 font-mono">
          {length.toLocaleString()} / {BODY_MAX.toLocaleString()}자 · 사진{" "}
          {imageCount} / {POST_IMAGE_MAX}장
        </span>
      </p>
      {uploading && <span className="sr-only">사진을 올리는 중이에요.</span>}
      {notice && (
        <p role="alert" className="text-sm text-danger">
          {notice}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
