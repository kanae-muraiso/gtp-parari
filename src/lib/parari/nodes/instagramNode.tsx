// apps/tools/parari/src/lib/parari/nodes/instagramNode.tsx
// 2026-03-30 JST

/**
 * PART: instagram node module
 * コメント:
 * - [INSTAGRAM] 行の parse / render を担当
 */

import React from "react";
import type { ParariNodeModule } from "./types";

function toInstagramEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const cleanPath = u.pathname.replace(/\/+$/, "");
    if (!cleanPath) return null;
    return `https://www.instagram.com${cleanPath}/embed`;
  } catch {
    return null;
  }
}

export const instagramNodeModule: ParariNodeModule = {
  type: "instagram",

  matchLine(line) {
    return line.trim().startsWith("[INSTAGRAM]");
  },

  parseLine({ line, pageIndex, nodeIndex }) {
    const url = line.replace(/^\[INSTAGRAM\]\s*/, "").trim();
    if (!url) return null;

    return {
      id: `instagram-${pageIndex}-${nodeIndex}`,
      type: "instagram",
      url,
    };
  },

  render({ node, key }) {
    if (node.type !== "instagram") return null;

    const embedUrl = toInstagramEmbedUrl(node.url);

    return embedUrl ? (
      <div key={key} className="w-full overflow-hidden rounded-2xl border">
        <iframe
          src={embedUrl}
          title={`instagram-${String(key)}`}
          className="block min-h-[650px] w-full border-0"
        />
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
