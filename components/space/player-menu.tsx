"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { blockUser } from "@/app/dm/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { sendRequest } from "@/lib/social/requests";

export type PlayerTarget = {
  id: string;
  nickname: string;
  x: number;
  y: number;
  areaW: number; // 메뉴가 찻집 화면 밖으로 나가지 않게
  areaH: number;
  // 이 사람이 찻집에서 맺은 모임. member는 나도 들어가 있는지
  group: { id: string; name: string; member: boolean } | null;
};

const MENU_W = 176;
const MENU_H = 240;

const ITEM =
  "block w-full rounded-sm px-2 py-1.5 text-left text-sm font-bold hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-subtle";

// 찻집에서 다른 사람 캐릭터를 눌렀을 때 뜨는 메뉴
export function PlayerMenu({
  target,
  onClose,
  onToast,
}: {
  target: PlayerTarget;
  onClose: () => void;
  onToast: (text: string) => void;
}) {
  const [view, setView] = useState<"menu" | "group" | "block">("menu");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const who = target.nickname;

  const send = (work: () => Promise<{ error: string | null }>, done: string) =>
    startTransition(async () => {
      setError(null);
      try {
        const res = await work();
        if (res.error) {
          if (view === "menu") {
            onToast(res.error);
            onClose();
          } else setError(res.error);
          return;
        }
        onToast(done);
        onClose();
      } catch {
        setError("처리하지 못했어요. 연결을 확인해 주세요.");
      }
    });

  return (
    // 팝업 안에서 글자를 쳐도 캐릭터가 움직이지 않게 한다
    <div
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" && view === "menu") onClose();
      }}
    >
      {view === "menu" && (
        <div
          aria-label={`${who}님 메뉴`}
          role="group"
          style={{
            left: Math.max(8, Math.min(target.x, target.areaW - MENU_W - 8)),
            top: Math.max(8, Math.min(target.y, target.areaH - MENU_H - 8)),
            width: MENU_W,
          }}
          className="absolute z-10 rounded-md border-2 border-ink bg-surface p-1.5 shadow-hard"
        >
          <p className="truncate border-b-2 border-sunken px-2 pb-1 text-xs font-bold text-ink-muted">
            {who}
          </p>
          <button
            type="button"
            className={ITEM}
            disabled={pending}
            onClick={() =>
              send(
                () => sendRequest("dm", target.id),
                `${who}님에게 대화를 요청했어요`,
              )
            }
          >
            1:1 채팅하기
          </button>
          {!target.group && (
            <button
              type="button"
              className={ITEM}
              onClick={() => setView("group")}
            >
              모임맺기
            </button>
          )}
          {target.group?.member && (
            <Link href={`/groups/${target.group.id}`} className={ITEM}>
              모임 보기
            </Link>
          )}
          {target.group && !target.group.member && (
            <button
              type="button"
              className={ITEM}
              disabled={pending}
              onClick={() =>
                send(
                  () =>
                    sendRequest("group_join", target.id, {
                      group_id: target.group!.id,
                    }),
                  "모임장에게 가입을 신청했어요",
                )
              }
            >
              모임 들어가기
            </button>
          )}
          <Link href={`/u/${target.id}`} className={ITEM}>
            프로필 보기
          </Link>
          <button
            type="button"
            className={`${ITEM} text-danger`}
            onClick={() => setView("block")}
          >
            차단
          </button>
        </div>
      )}

      <Modal open={view === "group"} onClose={onClose} title="모임맺기">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(
              () =>
                sendRequest("group_create", target.id, { name, description }),
              `${who}님에게 모임맺기를 신청했어요`,
            );
          }}
        >
          <p className="text-sm text-ink-muted">
            {who}님이 수락하면 모임이 만들어지고, 내가 모임장이 돼요.
          </p>
          <Input
            label="모임 이름"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 화요일 저녁 독서"
          />
          <Textarea
            label="모임 소개"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="어떤 모임인지 적어 주세요 (선택)"
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button loading={pending} disabled={name.trim().length < 2}>
            신청 보내기
          </Button>
        </form>
      </Modal>

      <Modal open={view === "block"} onClose={onClose} title="차단">
        <p>{who}님을 차단할까요? 서로 메시지와 요청을 보낼 수 없어요.</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            아니오
          </Button>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              send(() => blockUser(target.id), `${who}님을 차단했어요`)
            }
          >
            예
          </Button>
        </div>
      </Modal>
    </div>
  );
}
