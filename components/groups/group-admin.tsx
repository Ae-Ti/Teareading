"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  allowRejoin,
  kickMember,
  saveGroupInfo,
  setManager,
  setMute,
  type ActionResult,
  type GroupInfoState,
} from "@/app/groups/moderation-actions";
import { MiniAvatar } from "@/components/groups/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import type { MemberRole } from "./member-row";

// ── 모임 관리 (모임장): 이름·소개 수정 ──
export function GroupSettingsButton({
  groupId,
  name,
  description,
}: {
  groupId: string;
  name: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<GroupInfoState, FormData>(
    saveGroupInfo.bind(null, groupId),
    { error: null },
  );
  const saved = useRef(state.saved);
  // 저장에 성공하면 팝업을 닫는다
  useEffect(() => {
    if (state.saved && state.saved !== saved.current) {
      saved.current = state.saved;
      setOpen(false);
    }
  }, [state.saved]);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        모임 관리
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="모임 관리">
        <form
          action={action}
          className="flex flex-col gap-4"
          key={String(open)}
        >
          <Input
            label="모임 이름"
            name="name"
            defaultValue={name}
            maxLength={40}
            error={state.fieldErrors?.name}
          />
          <Textarea
            label="소개"
            name="description"
            defaultValue={description}
            maxLength={500}
            className="min-h-32"
            error={state.fieldErrors?.description}
          />
          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <Button loading={pending}>저장</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

// ── 멤버 관리 (모임장·부모임장) ──
type Member = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  role: MemberRole;
  muted: boolean;
};

export type BannedMember = {
  id: string;
  nickname: string;
  avatar_url: string | null;
};

export function MemberManageButton({
  groupId,
  myRole,
  me,
  members,
  banned = [],
}: {
  groupId: string;
  myRole: "owner" | "manager";
  me: string;
  members: Member[];
  banned?: BannedMember[];
}) {
  const [open, setOpen] = useState(false);
  const hasManager = members.some((m) => m.role === "manager");
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        멤버 관리
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="멤버 관리">
        <p className="mb-3 text-sm leading-relaxed text-ink-muted">
          {myRole === "owner"
            ? "부모임장 지정(모임당 1명), 메시지 차단, 강제 퇴장을 할 수 있어요. 메시지 삭제는 단체 채팅방에서 해요."
            : "부모임장은 일반 멤버의 메시지를 차단할 수 있어요. 메시지 삭제는 단체 채팅방에서 해요."}
        </p>
        <ul className="flex flex-col divide-y-2 divide-sunken">
          {members.map((m) => (
            <ManageRow
              key={m.id}
              groupId={groupId}
              member={m}
              myRole={myRole}
              isMe={m.id === me}
              hasManager={hasManager}
            />
          ))}
        </ul>
        {banned.length > 0 && (
          <section
            aria-label="강제 퇴장한 멤버"
            className="mt-4 border-t-2 border-ink pt-3"
          >
            <h3 className="font-bold">강제 퇴장한 멤버</h3>
            <p className="mb-1 text-sm text-ink-muted">
              재가입을 허용하기 전까지 이 모임에 다시 가입할 수 없어요.
            </p>
            <ul className="flex flex-col divide-y-2 divide-sunken">
              {banned.map((m) => (
                <BannedRow key={m.id} groupId={groupId} member={m} />
              ))}
            </ul>
          </section>
        )}
      </Modal>
    </>
  );
}

function BannedRow({
  groupId,
  member,
}: {
  groupId: string;
  member: BannedMember;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-2 py-3">
      <MiniAvatar
        nickname={member.nickname}
        src={member.avatar_url}
        className="size-9"
      />
      <span className="min-w-0 flex-1 truncate font-bold">
        {member.nickname}
      </span>
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await allowRejoin(groupId, member.id);
              if (res.error) setError(res.error);
            } catch {
              setError("처리하지 못했어요. 연결을 확인해 주세요.");
            }
          });
        }}
      >
        재가입 허용
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}

function ManageRow({
  groupId,
  member,
  myRole,
  isMe,
  hasManager,
}: {
  groupId: string;
  member: Member;
  myRole: "owner" | "manager";
  isMe: boolean;
  hasManager: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<ActionResult>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fn();
        if (res.error) setError(res.error);
      } catch {
        setError("처리하지 못했어요. 연결을 확인해 주세요.");
      }
    });
  };

  const owner = myRole === "owner";
  // 모임장: 모임장 외 모두 / 부모임장: 일반 멤버만
  const canMute =
    !isMe && member.role !== "owner" && (owner || member.role === "member");
  const canRole = owner && member.role !== "owner";
  const canKick = owner && member.role !== "owner";

  return (
    <li className="flex flex-col gap-2 py-3" aria-busy={pending}>
      <div className="flex items-center gap-2">
        <MiniAvatar
          nickname={member.nickname}
          src={member.avatar_url}
          className="size-9"
        />
        <span className="min-w-0 truncate font-bold">{member.nickname}</span>
        {member.role === "owner" && <Badge tone="yuja">모임장</Badge>}
        {member.role === "manager" && <Badge tone="hojicha">부모임장</Badge>}
        {member.muted && <Badge tone="danger">메시지 차단</Badge>}
        {isMe && <span className="text-xs text-ink-muted">나</span>}
      </div>
      {(canRole || canMute || canKick) && (
        <div className="flex flex-wrap gap-1.5 pl-11">
          {canRole &&
            (member.role === "manager" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => setManager(groupId, member.id, false))}
              >
                부모임장 해제
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setManager(groupId, member.id, true),
                    hasManager
                      ? `${member.nickname} 님을 부모임장으로 지정할까요? 지금 부모임장은 일반 멤버가 돼요.`
                      : undefined,
                  )
                }
              >
                부모임장 지정
              </Button>
            ))}
          {canMute &&
            (member.muted ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() => run(() => setMute(groupId, member.id, false))}
              >
                메시지 차단 해제
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  run(
                    () => setMute(groupId, member.id, true),
                    `${member.nickname} 님이 단체 채팅에 메시지를 보내지 못하게 할까요?`,
                  )
                }
              >
                메시지 차단
              </Button>
            ))}
          {canKick && (
            <Button
              size="sm"
              variant="danger"
              disabled={pending}
              onClick={() =>
                run(
                  () => kickMember(groupId, member.id),
                  `${member.nickname} 님을 모임에서 내보낼까요? 재가입을 허용하기 전까지 다시 가입할 수 없어요.`,
                )
              }
            >
              강제 퇴장
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="pl-11 text-sm text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
