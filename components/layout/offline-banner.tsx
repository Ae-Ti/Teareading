"use client";

import { useOffline } from "next/offline";

// 망이 끊기면 알린다. next.config의 experimental.useOffline이 끊긴 동안의 저장·이동을
// 멈춰 두었다가 다시 연결되면 한 번 보내므로, 쓰던 화면을 그대로 두고 기다리면 된다.
export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 border-b-2 border-ink bg-yuja px-4 py-2 text-center text-sm font-bold text-ink"
    >
      인터넷 연결이 끊겼어요. 다시 연결되면 저장과 이동을 이어서 해요.
    </div>
  );
}
