"use client";

import { useEffect, useState } from "react";
import type { PanelEditorProps } from "../panelDefinitionTypes";
import { RichTextField } from "../richText/RichTextField";
import type { NoticePanelData } from "./parseNoticePanel";
import { serializeNoticePanel } from "./serializeNoticePanel";

export function NoticePanelEditor({
  data,
  onChangeRaw,
}: PanelEditorProps<NoticePanelData>) {
  const [draftData, setDraftData] = useState<NoticePanelData>(data);

  useEffect(() => {
    setDraftData(data);
  }, [data.raw]);

  const commitData = (nextData: NoticePanelData = draftData) => {
    onChangeRaw?.(serializeNoticePanel(nextData));
  };

  const updateBody = (body: string) => {
    const nextData: NoticePanelData = {
      ...draftData,
      body,
    };

    setDraftData(nextData);
    commitData(nextData);
  };

  return (
    <div>
      <input
        value={draftData.title}
        onChange={(event) =>
          setDraftData((current) => ({
            ...current,
            title: event.target.value,
          }))
        }
        onBlur={(event) =>
          commitData({
            ...draftData,
            title: event.currentTarget.value,
          })
        }
        className="mb-2 w-full border-0 bg-transparent px-1 py-1 text-base font-semibold text-neutral-900 outline-none placeholder:text-neutral-400"
        placeholder="タイトル"
      />

      <RichTextField
        value={draftData.body}
        onChange={updateBody}
        placeholder="本文を入力"
        minHeightClassName="min-h-[110px]"
        borderless
      />
    </div>
  );
}
