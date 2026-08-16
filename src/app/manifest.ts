// apps/tools/parari/src/app/manifest.ts
// 2026-03-24 JST

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PARARI",
    short_name: "PARARI",
    description: "Reading device",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
