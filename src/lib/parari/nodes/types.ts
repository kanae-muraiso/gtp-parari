// apps/tools/parari/src/lib/parari/nodes/types.ts
// apps/tools/parari/src/lib/parari/nodes/types.ts
// 2026/06/11 12:00 JST

/**
 * PART: node module types
 * コメント:
 * - image / youtube / instagram / vimeo / application の module 共通型
 * - application は参照ノードとして applicationId を持つ
 */

import type React from "react";

export type ParariNode =
  | {
      id: string;
      type: "text";
      text: string;
    }
| {
    id: string;
    type: "image";
    url: string;
    alt?: string;
    width?: 70 | 90 | 100;
  }
  | {
      id: string;
      type: "youtube";
      url: string;
    }
  | {
      id: string;
      type: "instagram";
      url: string;
    }
  | {
      id: string;
      type: "vimeo";
      url: string;
    }
  | {
      id: string;
      type: "application";
      applicationId: string;
    }
  | {
      id: string;
      type: "link";
      linkId: string;
      url: string;
    };

export type ParariNodeModule = {
  type: string;

  matchLine: (line: string) => boolean;

  parseLine: (args: {
    line: string;
    pageIndex: number;
    nodeIndex: number;
  }) => ParariNode | null;

  render: (args: {
    node: ParariNode;
    key: React.Key;
  }) => React.ReactNode;
};
