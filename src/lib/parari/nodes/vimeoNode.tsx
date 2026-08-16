// apps/tools/parari/src/lib/parari/nodes/vimeoNode.tsx
// 2026-03-30 JST

/**
 * PART: vimeo node module
 * コメント:
 * - [VIMEO] 行の parse / render を担当
 */

import React from "react";
import type { ParariNodeModule } from "./types";

function toVimeoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/(\d+)/);
    if (m?.[1]) return `https://player.vimeo.com/video/${m[1]}`;
  } catch {
    return null;
  }

  return null;
}

export const vimeoNodeModule: ParariNodeModule = {
  type: "vimeo",

  matchLine(line) {
    return line.trim().startsWith("[VIMEO]");
  },

  parseLine({ line, pageIndex, nodeIndex }) {
    const url = line.replace(/^\[VIMEO\]\s*/, "").trim();
    if (!url) return null;

    return {
      id: `vimeo-${pageIndex}-${nodeIndex}`,
      type: "vimeo",
      url,
    };
  },

  render({ node, key }) {
    if (node.type !== "vimeo") return null;

    const embedUrl = toVimeoEmbedUrl(node.url);

    return embedUrl ? (
      <div key={key} className="w-full overflow-hidden rounded-2xl">
        <div className="relative w-full pt-[56.25%]">
          <iframe
            src={embedUrl}
            title={`vimeo-${String(key)}`}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className="absolute left-0 top-0 h-full w-full border-0"
          />
        </div>
      </div>
    ) : (
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
  },
};
