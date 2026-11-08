import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { monoKr, monoLatin, sansKr } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "티어리딩",
  description: "차를 마시고 책을 읽는 시간을 위한 다도 독서 플랫폼",
};

// 안드로이드에서 키보드가 열리면 화면 높이(dvh)를 줄여 채팅 입력창이 키보드 위에 남게 한다
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${sansKr.variable} ${monoLatin.variable} ${monoKr.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
