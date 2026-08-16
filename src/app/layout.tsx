// apps/tools/parari/src/app/layout.tsx
// apps/tools/parari/src/app/layout.tsx
// 2026-04-26 JST

import "./globals.css";
import React from "react";
import type { Metadata } from "next";

/**
 * PART: site metadata
 * コメント:
 * - トップページ共有時に LinkedIn / Facebook / X で
 *   ロゴ付きリンクプレビューが出るようにする
 * - metadataBase を入れて相対画像URLを正しく解決させる
 * - OGP/Twitter の両方を定義する
 * - SEOのため「PARARI（パラリ）」を正式表記として入れる
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://parari.app"),
  title: "PARARI（パラリ）｜写真と文章で作品をつくるアプリ",
  description:
    "PARARI（パラリ）は、写真と文章でページを作り、束ねて1冊の本にできるデジタル・コミュニケーションツールです。ぱらりと読めて、きちんと届くURLを作れます。",
  openGraph: {
    title: "PARARI（パラリ）",
    description:
      "写真と文章でページを作り、束ねて1冊の本にできるデジタル・コミュニケーションツールです。",
    url: "https://parari.app",
    siteName: "PARARI（パラリ）",
    locale: "ja_JP",
    type: "website",
    images: [
      {
        url: "/ogp/parari-ogp.png",
        width: 1200,
        height: 630,
        alt: "PARARI（パラリ）",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PARARI（パラリ）",
    description:
      "写真と文章でページを作り、束ねて1冊の本にできるデジタル・コミュニケーションツールです。",
    images: ["/ogp/parari-ogp.png"],
  },
};

/**
 * PART: RootLayout
 * コメント:
 * - アプリ全体の共通レイアウト
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
