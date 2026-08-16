// apps/tools/parari/src/lib/parari/nodes/youtubeNode.tsx
// 2026-03-30 JST

/**
 * PART: youtube node module
 * コメント:
 * - [YOUTUBE] 行の parse / render を担当
 */

import React from "react";
import type { ParariNodeModule } from "./types";

function toYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;

      const m = u.pathname.match(/^\/embed\/([^/]+)/);
      if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`;
    }
  } catch {
    return null;
  }

  return null;
}

export const youtubeNodeModule: ParariNodeModule = {
  type: "youtube",

  matchLine(line) {
    return line.trim().startsWith("[YOUTUBE]");
  },

  parseLine({ line, pageIndex, nodeIndex }) {
    const url = line.replace(/^\[YOUTUBE\]\s*/, "").trim();
    if (!url) return null;

    return {
      id: `youtube-${pageIndex}-${nodeIndex}`,
      type: "youtube",
      url,
    };
  },

  render({ node, key }) {
    if (node.type !== "youtube") return null;

    const embedUrl = toYoutubeEmbedUrl(node.url);

    if (!embedUrl) {
      return (
        <div key={key} className="text-sm break-all">
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            {node.url}
          </a>
        </div>
      );
    }

    return (
      <div key={key} className="w-full overflow-hidden rounded-2xl">
        <div className="relative w-full pt-[56.25%]">
          <iframe
            src={embedUrl}
            title={`youtube-${String(key)}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute left-0 top-0 h-full w-full border-0"
          />
        </div>
      </div>
    );
  },
};
