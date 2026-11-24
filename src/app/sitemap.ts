// src/app/sitemap.ts
// 2026-11-24 10:11 JST
// PART: Public static sitemap
// コメント:
// - 検索対象として明示的に公開する静的ページのみ列挙する。
// - 作者・作品・購入・管理・認証に関するURLを含めない。
// - 作品SSOT、Viewer、DBおよび公開権限には触れない。

import type { MetadataRoute } from "next";

const SITE_ORIGIN = "https://www.parari.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const publicPaths = ["/", "/packages", "/privacy", "/tokusho"];

  return publicPaths.map((path) => ({
    url: new URL(path, SITE_ORIGIN).toString(),
  }));
}
