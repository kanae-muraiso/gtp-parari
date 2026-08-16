// src/components/parari/viewer-v2/ParariPanelViewer.tsx
// PART: Minimal public viewer via PanelDefinition renderers

"use client";

import React from "react";
import { ReaderBodyPanelRenderer } from "@/components/parari/reader/ReaderBodyPanelRenderer";
import { ReaderSettingsBar } from "./ReaderSettingsBar";
import { ViewerTextBlock } from "./ViewerTextBlock";
import {
  readerFontFamilyClass,
  readerFontSizeClass,
  type ReaderDictionaryMode,
  type ReaderFontFamily,
  type ReaderFontSize,
} from "./viewerTextStyles";

type ParariPanelViewerProps = {
  content?: string | null;

  /**
   * reader:
   *   BOOK・通常PAGE用の従来表示。
   *
   * web:
   *   WEB用。背景と本文を白で一続きにする。
   *
   * 指定しない場合は必ずreaderになるため、
   * 既存のBOOK表示には影響しない。
   */
  displayMode?: "reader" | "web";
};

export default function ParariPanelViewer({
  content = "",
  displayMode = "reader",
}: ParariPanelViewerProps) {
  const bodySsot = String(content ?? "");
  const [fontSize, setFontSize] = React.useState<ReaderFontSize>("standard");
  const [fontFamily, setFontFamily] =
    React.useState<ReaderFontFamily>("standard");
  const [dictionaryMode, setDictionaryMode] =
    React.useState<ReaderDictionaryMode>("off");

  const textClassName = [
    "mx-auto mb-6 w-[90%] text-neutral-900",
    readerFontSizeClass(fontSize),
    readerFontFamilyClass(fontFamily),
  ].join(" ");

  const isWebMode =
    displayMode === "web";

  return (
    <main
      className={
        isWebMode
          ? "min-h-screen bg-white"
          : "min-h-screen bg-neutral-100"
      }
    >
      <ReaderSettingsBar
        fontSize={fontSize}
        fontFamily={fontFamily}
        dictionaryMode={dictionaryMode}
        onChangeFontSize={setFontSize}
        onChangeFontFamily={setFontFamily}
        onChangeDictionaryMode={setDictionaryMode}
      />

      <div
        className={[
          "mx-auto min-h-screen w-full bg-white py-6",
          isWebMode
            ? "max-w-[720px]"
            : "max-w-[440px] shadow-sm md:max-w-[720px]",
        ].join(" ")}
      >
        <ReaderBodyPanelRenderer
          bodySsot={bodySsot}
          emptyFallback={
            <div className="mx-auto w-[90%] rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-500">
              表示できる本文がありません。
            </div>
          }
          renderTextBlock={({ text, tocHeadingStartIndex }) => (
            <ViewerTextBlock
              text={text}
              className={textClassName}
              dictionaryMode={dictionaryMode}
              headingStartIndex={tocHeadingStartIndex}
            />
          )}
        />
      </div>
    </main>
  );
}
