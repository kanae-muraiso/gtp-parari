// src/components/parari/PublicViewerShell.tsx
// 2026/07/21 16:57
// PART: Public viewer shell using viewer-v2 only

"use client";

import React from "react";
import { supabase } from "../../lib/supabaseClient";
import {
  ParariBrandTopBar,
  ParariOwnerTopBar,
  ParariTopBarButton,
} from "./ParariTopBars";
import ParariPanelViewer from "./viewer-v2/ParariPanelViewer";
import { ParariBookViewer } from "./viewer-v2/ParariBookViewer";
import { isBookLikeSsot } from "./viewer-v2/book/buildBookSheets";
import ParariWebViewer from "./viewer-v2/ParariWebViewer";
import { isWebLikeSsot } from "./viewer-v2/web/webSsot";

type RenderMode = "scroll" | "cover-scroll" | "page-scroll" | "page";

type Props = {
  doc?: any;
  content?: string | null;
  renderMode?: RenderMode | null;
  physicalPagination?: boolean | null;
  bookId: string;
  ownerId: string | null;
  pageSlug?: string | null;
  publicBasePath?: string;
  headerLogoUrl?: string | null;
};

export default function PublicViewerShell({
  doc,
  content = "",
  bookId,
  ownerId,
  pageSlug = null,
  publicBasePath = "",
  headerLogoUrl = null,
}: Props) {
  const [isOwner, setIsOwner] = React.useState(false);
  const [ownerCheckDone, setOwnerCheckDone] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    const run = async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;

      if (!mounted) return;

      setIsOwner(!!uid && !!ownerId && uid === ownerId);
      setOwnerCheckDone(true);
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [ownerId]);

  const viewerContent = resolveViewerContent(content, doc);

  return (
    <div>
          {ownerCheckDone ? (
            <>
              {isOwner ? (
                <ParariOwnerTopBar
                  title="公開表示確認"
                  leftHref="/my/works"
                  leftLabel="作品リストへ"
                  actions={
                    <ParariTopBarButton href={`/editor-v2/${bookId}`}>
                      編集
                    </ParariTopBarButton>
                  }
                />
              ) : (
                <ParariBrandTopBar href="/" />
              )}

              {isWebLikeSsot(viewerContent) ? (
                <ParariWebViewer
                  content={viewerContent}
                  pageSlug={pageSlug}
                  publicBasePath={publicBasePath}
                  headerLogoUrl={headerLogoUrl}
                />
              ) : isBookLikeSsot(viewerContent) ? (
                <ParariBookViewer content={viewerContent} />
              ) : (
                <ParariPanelViewer content={viewerContent} />
              )}
            </>
          ) : null}
          
    </div>
  );
}

function resolveViewerContent(content: unknown, doc: unknown): string {
  const directContent = String(content ?? "");

  if (directContent.trim().length > 0) {
    return directContent;
  }

  if (doc && typeof doc === "object") {
    const record = doc as Record<string, unknown>;

    const candidateKeys = ["content", "ssot", "rawContent", "bodySsot"];

    for (const key of candidateKeys) {
      const value = record[key];

      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  return "";
}
