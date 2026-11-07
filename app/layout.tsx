import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { monoKr, monoLatin, sansKr } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "티어리딩",
  description: "차를 마시고 책을 읽는 시간을 위한 다도 독서 플랫폼",
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
