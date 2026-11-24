// src/app/robots.ts
// 2026-11-24 11:15 JST
// PART: Crawler directions for public search pages
// コメント:
// - 公開ページと作品は通常のクローラーが発見できるようにする。
// - 内部操作URLはクロールを抑制する（アクセス権の代用ではない）。
// - OAI-SearchBotはUser-agent * の許可対象。GPTBotポリシーは別途決定。

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/my/",
          "/mypage",
          "/editor",
          "/writing/",
          "/billing",
          "/login",
          "/q/",
          "/c/",
          "/access/",
        ],
      },
    ],
    sitemap: "https://www.parari.app/sitemap.xml",
    host: "https://www.parari.app",
  };
}
