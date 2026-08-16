"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  createEtTextSegmentId,
  EtTextPanelData,
  EtTextSegment,
  hasCharRangeOverlap,
  normalizeEtTextInput,
  sortEtTextSegments,
} from "./types";
import { EtTextBoundaryMarker, EtTextWaveform } from "./EtTextWaveform";

type DraftSegment = {
  charStart: number | null;
  charEnd: number | null;
  selectedText: string;
  audioStart: number | null;
  audioEnd: number | null;
};

type EtTextPanelEditorProps = {
  value: EtTextPanelData;
  onChange: (next: EtTextPanelData) => void;
};

function formatTime(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "--:--.--";

  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;

  return `${String(minutes).padStart(2, "0")}:${seconds
    .toFixed(2)
    .padStart(5, "0")}`;
}

function getSelectedRange(
  textarea: HTMLTextAreaElement | null,
  text: string
): {
  charStart: number;
  charEnd: number;
  selectedText: string;
} | null {
  if (!textarea) return null;

  const charStart = textarea.selectionStart;
  const charEnd = textarea.selectionEnd;

  if (charEnd <= charStart) return null;

  return {
    charStart,
    charEnd,
    selectedText: text.slice(charStart, charEnd),
  };
}

export function EtTextPanelEditor({
  value,
  onChange,
}: EtTextPanelEditorProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const stopAtRef = useRef<number | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedBoundaryIndex, setSelectedBoundaryIndex] = useState<number | null>(null);
  const [selectionPreview, setSelectionPreview] = useState("");
  const [draft, setDraft] = useState<DraftSegment>({
    charStart: null,
    charEnd: null,
    selectedText: "",
    audioStart: null,
    audioEnd: null,
  });
  const [textEditedAfterSync, setTextEditedAfterSync] = useState(false);

  const sortedSegments = useMemo(
    () => sortEtTextSegments(value.segments ?? []),
    [value.segments]
  );

  function updateSelectionPreview() {
    const selected = getSelectedRange(textareaRef.current, value.text);
    setSelectionPreview(selected?.selectedText ?? "");
  }

  function updateAudioUrl(audioUrl: string) {
    onChange({
      ...value,
      audioUrl,
    });
  }

  function updateText(text: string) {
    const normalized = normalizeEtTextInput(text);

    if ((value.segments?.length ?? 0) > 0 && normalized !== value.text) {
      setTextEditedAfterSync(true);
    }

    onChange({
      ...value,
      text: normalized,
    });
  }

  function handleAudioTimeUpdate() {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);

    if (stopAtRef.current != null && audio.currentTime >= stopAtRef.current) {
      audio.pause();
      stopAtRef.current = null;
    }
  }

  function handleAudioLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);
    setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
  }

  function seekAudio(time: number) {
    const audio = audioRef.current;
    if (!audio) return;

    const nextTime = Math.max(0, Math.min(time, Number.isFinite(audio.duration) ? audio.duration : time));
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function createEmptyAudioSegment(audioStart: number, audioEnd: number): EtTextSegment {
    return {
      id: createEtTextSegmentId(),
      charStart: 0,
      charEnd: 0,
      audioStart,
      audioEnd,
      selectedText: "",
    };
  }

  function insertBoundaryAtTime(time: number, options?: { seek?: boolean }) {
    const shouldSeek = options?.seek ?? false;
    const minGap = 0.05;
    const safeDuration = duration > 0 ? duration : Number.POSITIVE_INFINITY;
    const boundaryTime = Math.max(0, Math.min(time, safeDuration));

    const segments = [...(value.segments ?? [])]
      .map((segment) => ({ ...segment }))
      .sort((a, b) => a.audioStart - b.audioStart);

    if (boundaryTime <= 0) return;

    let nextSegments: EtTextSegment[] = [];
    let selectedIndex: number | null = null;

    if (segments.length === 0) {
      nextSegments = [createEmptyAudioSegment(0, boundaryTime)];
      selectedIndex = 1;
    } else {
      const first = segments[0];
      const last = segments[segments.length - 1];

      if (!first || !last) return;

      // 既存boundaryに近すぎる場合は、追加せずそのboundaryを選択
      const existingBoundaries = [
        first.audioStart,
        ...segments.map((segment) => segment.audioEnd),
      ];

      const nearBoundaryIndex = existingBoundaries.findIndex(
        (boundary) => Math.abs(boundary - boundaryTime) < minGap
      );

      if (nearBoundaryIndex >= 0) {
        setSelectedBoundaryIndex(nearBoundaryIndex);
        if (shouldSeek) {
          seekAudio(existingBoundaries[nearBoundaryIndex] ?? boundaryTime);
        }
        return;
      }

      // 最後より後ろなら、末尾に新しいaudio-only segmentを追加
      if (boundaryTime > last.audioEnd + minGap) {
        nextSegments = [
          ...segments,
          createEmptyAudioSegment(last.audioEnd, boundaryTime),
        ];
        selectedIndex = nextSegments.length;
      } else if (boundaryTime < first.audioStart - minGap) {
        // 先頭より前なら、先頭segmentを前へ伸ばす
        first.audioStart = boundaryTime;
        nextSegments = segments;
        selectedIndex = 0;
      } else {
        // 既存segmentの中なら、そのsegmentを分割する
        const targetIndex = segments.findIndex(
          (segment) =>
            boundaryTime > segment.audioStart + minGap &&
            boundaryTime < segment.audioEnd - minGap
        );

        if (targetIndex < 0) {
          return;
        }

        const target = segments[targetIndex];

        if (!target) return;

        const before = {
          ...target,
          id: createEtTextSegmentId(),
          audioEnd: boundaryTime,
          // 音声境界作成段階ではテキストは後で割り当てる
          charStart: 0,
          charEnd: 0,
          selectedText: "",
        };

        const after = {
          ...target,
          id: createEtTextSegmentId(),
          audioStart: boundaryTime,
          // 音声境界作成段階ではテキストは後で割り当てる
          charStart: 0,
          charEnd: 0,
          selectedText: "",
        };

        nextSegments = [
          ...segments.slice(0, targetIndex),
          before,
          after,
          ...segments.slice(targetIndex + 1),
        ];

        selectedIndex = targetIndex + 1;
      }
    }

    onChange({
      ...value,
      segments: nextSegments,
    });

    if (selectedIndex != null) {
      setSelectedBoundaryIndex(selectedIndex);
    }

    if (shouldSeek) {
      seekAudio(boundaryTime);
    }
  }

  function insertBoundaryAtCurrentTime() {
    insertBoundaryAtTime(currentTime, { seek: false });
  }

  const boundaryMarkers = useMemo<EtTextBoundaryMarker[]>(() => {
    const segments = [...(value.segments ?? [])].sort(
      (a, b) => a.audioStart - b.audioStart
    );

    if (segments.length === 0) return [];

    const markers: EtTextBoundaryMarker[] = [];

    markers.push({
      id: "boundary-0",
      index: 0,
      time: segments[0]?.audioStart ?? 0,
      label: "S",
      kind: "edge",
    });

    for (let index = 1; index < segments.length; index += 1) {
      const previous = segments[index - 1];
      const next = segments[index];

      if (!previous || !next) continue;

      const diff = Math.abs(previous.audioEnd - next.audioStart);

      markers.push({
        id: `boundary-${index}`,
        index,
        time: diff < 0.02
          ? previous.audioEnd
          : (previous.audioEnd + next.audioStart) / 2,
        label: String(index),
        kind: diff < 0.02 ? "shared" : "shared",
      });
    }

    const last = segments[segments.length - 1];

    if (last) {
      markers.push({
        id: `boundary-${segments.length}`,
        index: segments.length,
        time: last.audioEnd,
        label: "E",
        kind: "edge",
      });
    }

    return markers;
  }, [value.segments]);

  const selectedBoundary = boundaryMarkers.find(
    (marker) => marker.index === selectedBoundaryIndex
  ) ?? null;

  function updateBoundaryTime(boundaryIndex: number, nextTime: number) {
    const segments = [...(value.segments ?? [])].sort(
      (a, b) => a.audioStart - b.audioStart
    );

    if (segments.length === 0) return;

    const safeTime = Math.max(0, nextTime);
    const nextSegments = segments.map((segment) => ({ ...segment }));

    if (boundaryIndex <= 0) {
      const first = nextSegments[0];
      if (!first) return;

      first.audioStart = Math.min(safeTime, first.audioEnd - 0.01);
    } else if (boundaryIndex >= nextSegments.length) {
      const last = nextSegments[nextSegments.length - 1];
      if (!last) return;

      last.audioEnd = Math.max(safeTime, last.audioStart + 0.01);
    } else {
      const previous = nextSegments[boundaryIndex - 1];
      const next = nextSegments[boundaryIndex];

      if (!previous || !next) return;

      const minTime = previous.audioStart + 0.01;
      const maxTime = next.audioEnd - 0.01;
      const clampedTime = Math.max(minTime, Math.min(maxTime, safeTime));

      // ここがboundary編集の核:
      // 前segmentの終了点と次segmentの開始点を同じ値にする
      previous.audioEnd = clampedTime;
      next.audioStart = clampedTime;
    }

    onChange({
      ...value,
      segments: nextSegments,
    });
  }

  function nudgeSelectedBoundary(delta: number) {
    if (selectedBoundary == null) return;

    const nextTime = selectedBoundary.time + delta;
    updateBoundaryTime(selectedBoundary.index, nextTime);
    seekAudio(nextTime);
  }

  function selectBoundary(index: number) {
    setSelectedBoundaryIndex(index);

    const marker = boundaryMarkers.find((item) => item.index === index);
    if (marker) {
      seekAudio(marker.time);
    }
  }

  function recordStart() {
    const selected = getSelectedRange(textareaRef.current, value.text);
    const audio = audioRef.current;

    if (!selected) {
      window.alert("先に本文の同期したい範囲を選択してください。");
      return;
    }

    if (!audio) {
      window.alert("音声が読み込まれていません。");
      return;
    }

    setDraft((prev) => ({
      charStart: selected.charStart,
      charEnd: selected.charEnd,
      selectedText: selected.selectedText,
      audioStart: audio.currentTime,
      audioEnd: prev.audioEnd,
    }));

    setSelectionPreview(selected.selectedText);
  }

  function recordEnd() {
    const audio = audioRef.current;

    if (!audio) {
      window.alert("音声が読み込まれていません。");
      return;
    }

    if (
      draft.charStart == null ||
      draft.charEnd == null ||
      draft.audioStart == null
    ) {
      window.alert("先に開始点を記録してください。");
      return;
    }

    setDraft((prev) => ({
      ...prev,
      audioEnd: audio.currentTime,
    }));
  }

  function saveDraftSegment() {
    if (
      draft.charStart == null ||
      draft.charEnd == null ||
      draft.audioStart == null ||
      draft.audioEnd == null
    ) {
      window.alert("開始点と終了点の両方を記録してください。");
      return;
    }

    if (draft.charEnd <= draft.charStart) {
      window.alert("テキストの選択範囲が正しくありません。");
      return;
    }

    if (draft.audioEnd <= draft.audioStart) {
      window.alert("音声の終了点は開始点より後にしてください。");
      return;
    }

    const currentSelectedText = value.text.slice(draft.charStart, draft.charEnd);

    if (currentSelectedText !== draft.selectedText) {
      window.alert(
        "本文が変更され、選択範囲の文字列が変わっています。もう一度選択してください。"
      );
      return;
    }

    const candidate = {
      charStart: draft.charStart,
      charEnd: draft.charEnd,
    };

    if (hasCharRangeOverlap(candidate, value.segments ?? [])) {
      window.alert("このテキスト範囲は、すでに別の同期区間と重なっています。");
      return;
    }

    const nextSegment: EtTextSegment = {
      id: createEtTextSegmentId(),
      charStart: draft.charStart,
      charEnd: draft.charEnd,
      audioStart: draft.audioStart,
      audioEnd: draft.audioEnd,
      selectedText: draft.selectedText,
    };

    onChange({
      ...value,
      segments: sortEtTextSegments([...(value.segments ?? []), nextSegment]),
    });

    setDraft({
      charStart: null,
      charEnd: null,
      selectedText: "",
      audioStart: null,
      audioEnd: null,
    });

    setSelectionPreview("");
  }

  function deleteSegment(id: string) {
    onChange({
      ...value,
      segments: (value.segments ?? []).filter((seg) => seg.id !== id),
    });
  }

  async function playFrom(time: number) {
    const audio = audioRef.current;
    if (!audio) return;

    stopAtRef.current = null;
    audio.currentTime = time;
    await audio.play();
  }

  async function playSegment(segment: EtTextSegment) {
    const audio = audioRef.current;
    if (!audio) return;

    stopAtRef.current = segment.audioEnd;
    audio.currentTime = segment.audioStart;
    await audio.play();
  }

  function selectSegmentText(segment: EtTextSegment) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(segment.charStart, segment.charEnd);
    setSelectionPreview(value.text.slice(segment.charStart, segment.charEnd));
  }

  return (
    <div className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 space-y-4">
      <div>
        <div className="text-sm font-bold text-yellow-900">
          ETTEXT 音声同期テキスト
        </div>
        <div className="mt-1 text-xs text-yellow-800">
          プレーンテキストの選択範囲に、音声の開始点・終了点を記録します。
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          音声URL
        </label>
        <input
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          value={value.audioUrl ?? ""}
          onChange={(event) => updateAudioUrl(event.target.value)}
          placeholder="https://audio.parari.jp/et/work/day01.mp3"
        />
      </div>

      {value.audioUrl ? (
        <div className="space-y-2">
          <audio
            ref={audioRef}
            src={value.audioUrl}
            controls
            preload="metadata"
            onTimeUpdate={handleAudioTimeUpdate}
            onLoadedMetadata={handleAudioLoadedMetadata}
            className="w-full"
          />
          <div className="text-xs text-slate-700">
            現在位置:{" "}
            <span className="font-mono">{formatTime(currentTime)}</span>
          </div>

          <EtTextWaveform
            audioUrl={value.audioUrl}
            duration={duration}
            currentTime={currentTime}
            segments={value.segments ?? []}
            draftSegment={{
              audioStart: draft.audioStart,
              audioEnd: draft.audioEnd,
            }}
            boundaryMarkers={boundaryMarkers}
            selectedBoundaryIndex={selectedBoundaryIndex}
            onSeek={seekAudio}
            onSelectBoundary={selectBoundary}
            onSetDraftStart={(time) => {
              setDraft((previous) => ({
                ...previous,
                audioStart: time,
              }));
            }}
            onSetDraftEnd={(time) => {
              setDraft((previous) => ({
                ...previous,
                audioEnd: time,
              }));
            }}
          />

          <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold text-blue-900">
                Boundary編集
              </div>

              <div className="text-[11px] text-blue-700">
                青いマーカーをクリックして選択します。内部boundaryは前segment終了点と次segment開始点を同時に動かします。
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-blue-200 bg-white p-2">
              <button
                type="button"
                onClick={insertBoundaryAtCurrentTime}
                className="rounded bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
              >
                ＋ 現在位置にboundary追加
              </button>

              <div className="text-[11px] text-blue-800">
                音声を流しながら、区切りたい瞬間にクリックします。音声は止まりません。
                現在位置: {formatTime(currentTime)}
              </div>
            </div>

            {selectedBoundary ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="mr-2 text-xs text-blue-900">
                  選択中: {selectedBoundary.label} / {formatTime(selectedBoundary.time)}
                </div>

                <button
                  type="button"
                  onClick={() => nudgeSelectedBoundary(-0.1)}
                  className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                >
                  -0.10
                </button>

                <button
                  type="button"
                  onClick={() => nudgeSelectedBoundary(-0.03)}
                  className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                >
                  -0.03
                </button>

                <button
                  type="button"
                  onClick={() => nudgeSelectedBoundary(0.03)}
                  className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                >
                  +0.03
                </button>

                <button
                  type="button"
                  onClick={() => nudgeSelectedBoundary(0.1)}
                  className="rounded border border-blue-300 bg-white px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                >
                  +0.10
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedBoundaryIndex(null)}
                  className="ml-auto rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  選択解除
                </button>
              </div>
            ) : (
              <div className="text-xs text-blue-700">
                boundary未選択です。波形上の青い線の近くをクリックしてください。
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
          音声URLを入力すると、ここにプレイヤーが表示されます。
        </div>
      )}

      {textEditedAfterSync && (
        <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-xs text-orange-900">
          本文が変更されています。既存の同期位置がずれている可能性があります。
        </div>
      )}

      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          本文
        </label>
        <textarea
          ref={textareaRef}
          className="min-h-[260px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm leading-7"
          value={value.text ?? ""}
          onChange={(event) => updateText(event.target.value)}
          onSelect={updateSelectionPreview}
          onMouseUp={updateSelectionPreview}
          onKeyUp={updateSelectionPreview}
          placeholder="ここに音声に対応する英文テキストを貼り付けます。"
        />
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
        <div className="text-xs font-semibold text-slate-700">
          選択中テキスト
        </div>
        <div className="min-h-[48px] rounded bg-slate-50 p-2 text-sm whitespace-pre-wrap">
          {selectionPreview || (
            <span className="text-slate-400">
              本文をドラッグ選択してください。
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={recordStart}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            開始点を現在位置にする
          </button>

          <button
            type="button"
            onClick={recordEnd}
            className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white"
          >
            終了点を現在位置にする
          </button>

          <button
            type="button"
            onClick={saveDraftSegment}
            className="rounded-md bg-yellow-500 px-3 py-2 text-sm font-semibold text-slate-950"
          >
            同期区間を保存
          </button>
        </div>

        <div className="text-xs text-slate-600">
          draft: text{" "}
          <span className="font-mono">
            {draft.charStart ?? "-"}-{draft.charEnd ?? "-"}
          </span>{" "}
          / audio{" "}
          <span className="font-mono">
            {formatTime(draft.audioStart)} - {formatTime(draft.audioEnd)}
          </span>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-semibold text-slate-700">
          保存済み同期区間
        </div>

        {sortedSegments.length === 0 ? (
          <div className="text-xs text-slate-400">
            まだ同期区間はありません。
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSegments.map((segment, index) => {
              const actualText = value.text.slice(
                segment.charStart,
                segment.charEnd
              );
              const isBroken = actualText !== segment.selectedText;

              return (
                <div
                  key={segment.id}
                  className="rounded-md border border-slate-200 bg-slate-50 p-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">
                      #{index + 1}{" "}
                      <span className="font-mono">
                        {segment.charStart}-{segment.charEnd}
                      </span>{" "}
                      /{" "}
                      <span className="font-mono">
                        {formatTime(segment.audioStart)}-
                        {formatTime(segment.audioEnd)}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => playFrom(segment.audioStart)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        開始から再生
                      </button>

                      <button
                        type="button"
                        onClick={() => playSegment(segment)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        区間再生
                      </button>

                      <button
                        type="button"
                        onClick={() => selectSegmentText(segment)}
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        本文選択
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteSegment(segment.id)}
                        className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 text-sm whitespace-pre-wrap">
                    {actualText}
                  </div>

                  {isBroken && (
                    <div className="mt-2 rounded bg-orange-50 p-2 text-xs text-orange-800">
                      保存時の文字列と現在の本文が一致しません。同期位置がずれている可能性があります。
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
