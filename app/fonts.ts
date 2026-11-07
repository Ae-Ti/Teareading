import {
  JetBrains_Mono,
  Nanum_Gothic_Coding,
  Noto_Sans_KR,
} from "next/font/google";

// 제목: 라틴은 JetBrains Mono, 한글은 나눔고딕코딩 (둘 다 OFL, 상업 이용 가능)
export const monoLatin = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-mono-latin",
});

export const monoKr = Nanum_Gothic_Coding({
  weight: ["400", "700"],
  variable: "--font-mono-kr",
  preload: false,
});

// 본문: Noto Sans KR (OFL)
export const sansKr = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  variable: "--font-sans-kr",
  preload: false,
});
