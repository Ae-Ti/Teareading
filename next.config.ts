import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 5MB 글 사진과 multipart 필드·경계 오버헤드를 수용한다.
    serverActions: { bodySizeLimit: "6mb" },
    // 망이 끊긴 동안의 저장(서버 함수)·이동을 오류로 버리지 않고 기다렸다가 다시 보낸다.
    // 끊김 안내는 components/layout/offline-banner.tsx
    useOffline: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
