"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { EtTextSegment } from "./types";

type DraftWaveformSegment = {
  audioStart: number | null;
  audioEnd: number | null;
};

export type EtTextBoundaryMarker = {
  id: string;
  index: number;
  time: number;
  label: string;
  kind: "edge" | "shared" | "gapEnd" | "gapStart";
};

type EtTextWaveformProps = {
  audioUrl: string;
  duration: number;
  currentTime: number;
  segments: EtTextSegment[];
  draftSegment?: DraftWaveformSegment;
  boundaryMarkers?: EtTextBoundaryMarker[];
  selectedBoundaryIndex?: number | null;
  onSeek?: (time: number) => void;
  onSetDraftStart?: (time: number) => void;
  onSetDraftEnd?: (time: number) => void;
  onSelectBoundary?: (index: number) => void;
};

type WaveformClickMode = "seek" | "start" | "end";

type WaveformState = {
  status: "idle" | "loading" | "ready" | "error";
  peaks: number[];
  decodedDuration: number;
  errorMessage: string;
};

const PEAK_COUNT = 1000;
const MARKER_HIT_PX = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;

  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ||
    null
  );
}

function buildPeaks(buffer: AudioBuffer, peakCount: number): number[] {
  const channelData = buffer.getChannelData(0);
  const samplesPerPeak = Math.max(1, Math.floor(channelData.length / peakCount));
  const peaks: number[] = [];

  for (let i = 0; i < peakCount; i += 1) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, channelData.length);

    let max = 0;

    for (let j = start; j < end; j += 1) {
      const value = Math.abs(channelData[j] ?? 0);
      if (value > max) max = value;
    }

    peaks.push(max);
  }

  const globalMax = Math.max(...peaks, 0.0001);
  return peaks.map((peak) => peak / globalMax);
}

function timeToX(time: number, duration: number, width: number): number {
  if (!duration || duration <= 0) return 0;
  return clamp((time / duration) * width, 0, width);
}

function findNearestMarker(
  markers: EtTextBoundaryMarker[],
  x: number,
  duration: number,
  width: number
): EtTextBoundaryMarker | null {
  if (!duration || duration <= 0) return null;

  let best: EtTextBoundaryMarker | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const marker of markers) {
    const markerX = timeToX(marker.time, duration, width);
    const distance = Math.abs(markerX - x);

    if (distance < bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }

  return best && bestDistance <= MARKER_HIT_PX ? best : null;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  options: {
    duration: number;
    currentTime: number;
    segments: EtTextSegment[];
    draftSegment?: DraftWaveformSegment;
    boundaryMarkers: EtTextBoundaryMarker[];
    selectedBoundaryIndex?: number | null;
  }
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(150, Math.floor(rect.height || 150));

  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  // background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // center line
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // saved segments
  for (const segment of options.segments) {
    const x1 = timeToX(segment.audioStart, options.duration, width);
    const x2 = timeToX(segment.audioEnd, options.duration, width);
    const w = Math.max(1, x2 - x1);

    ctx.fillStyle = "rgba(250, 204, 21, 0.18)";
    ctx.fillRect(x1, 0, w, height);
  }

  // waveform
  const centerY = height / 2;
  const maxAmp = height * 0.42;
  const barWidth = Math.max(1, width / Math.max(peaks.length, 1));

  ctx.fillStyle = "#475569";

  for (let i = 0; i < peaks.length; i += 1) {
    const peak = peaks[i] ?? 0;
    const x = i * barWidth;
    const h = Math.max(1, peak * maxAmp);
    ctx.fillRect(x, centerY - h, Math.max(1, barWidth), h * 2);
  }

  // boundary markers
  for (const marker of options.boundaryMarkers) {
    const x = timeToX(marker.time, options.duration, width);
    const selected = marker.index === options.selectedBoundaryIndex;

    if (marker.kind === "edge") {
      ctx.strokeStyle = selected ? "#1d4ed8" : "rgba(100, 116, 139, 0.85)";
    } else if (marker.kind === "shared") {
      ctx.strokeStyle = selected ? "#1d4ed8" : "rgba(37, 99, 235, 0.8)";
    } else {
      ctx.strokeStyle = selected ? "#7c3aed" : "rgba(124, 58, 237, 0.72)";
    }

    ctx.lineWidth = selected ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    if (selected) {
      ctx.fillStyle = "rgba(29, 78, 216, 0.12)";
      ctx.fillRect(Math.max(0, x - 8), 0, 16, height);
    }

    ctx.fillStyle = selected ? "#1d4ed8" : "#334155";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(marker.label, x, 12);
  }

  // draft start
  const draft = options.draftSegment;
  if (draft?.audioStart != null) {
    const x = timeToX(draft.audioStart, options.duration, width);
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // draft end
  if (draft?.audioEnd != null) {
    const x = timeToX(draft.audioEnd, options.duration, width);
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // playhead
  const playheadX = timeToX(options.currentTime, options.duration, width);
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playheadX, 0);
  ctx.lineTo(playheadX, height);
  ctx.stroke();
}

export function EtTextWaveform({
  audioUrl,
  duration,
  currentTime,
  segments,
  draftSegment,
  boundaryMarkers = [],
  selectedBoundaryIndex = null,
  onSeek,
  onSetDraftStart,
  onSetDraftEnd,
  onSelectBoundary,
}: EtTextWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [clickMode, setClickMode] = useState<WaveformClickMode>("seek");
  const [waveform, setWaveform] = useState<WaveformState>({
    status: "idle",
    peaks: [],
    decodedDuration: 0,
    errorMessage: "",
  });

  const effectiveDuration =
    duration > 0
      ? duration
      : waveform.decodedDuration > 0
        ? waveform.decodedDuration
        : 0;

  const canDraw =
    waveform.status === "ready" &&
    waveform.peaks.length > 0 &&
    effectiveDuration > 0;

  const sortedSegments = useMemo(
    () => [...segments].sort((a, b) => a.audioStart - b.audioStart),
    [segments]
  );

  const sortedMarkers = useMemo(
    () => [...boundaryMarkers].sort((a, b) => a.time - b.time),
    [boundaryMarkers]
  );

  useEffect(() => {
    if (!audioUrl) {
      setWaveform({
        status: "idle",
        peaks: [],
        decodedDuration: 0,
        errorMessage: "",
      });
      return;
    }

    let cancelled = false;
    let audioContext: AudioContext | null = null;

    async function loadWaveform() {
      setWaveform({
        status: "loading",
        peaks: [],
        decodedDuration: 0,
        errorMessage: "",
      });

      try {
        const response = await fetch(audioUrl, {
          method: "GET",
          mode: "cors",
          cache: "force-cache",
        });

        if (!response.ok) {
          throw new Error(`音声ファイルを取得できませんでした: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const AudioContextConstructor = getAudioContextConstructor();

        if (!AudioContextConstructor) {
          throw new Error("このブラウザではAudioContextを利用できません。");
        }

        audioContext = new AudioContextConstructor();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const peaks = buildPeaks(audioBuffer, PEAK_COUNT);

        if (cancelled) return;

        setWaveform({
          status: "ready",
          peaks,
          decodedDuration: audioBuffer.duration,
          errorMessage: "",
        });
      } catch (error) {
        if (cancelled) return;

        setWaveform({
          status: "error",
          peaks: [],
          decodedDuration: 0,
          errorMessage:
            error instanceof Error
              ? error.message
              : "波形の読み込みに失敗しました。",
        });
      } finally {
        if (audioContext) {
          void audioContext.close();
        }
      }
    }

    void loadWaveform();

    return () => {
      cancelled = true;

      if (audioContext) {
        void audioContext.close();
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canDraw) return;

    drawWaveform(canvas, waveform.peaks, {
      duration: effectiveDuration,
      currentTime,
      segments: sortedSegments,
      draftSegment,
      boundaryMarkers: sortedMarkers,
      selectedBoundaryIndex,
    });
  }, [
    canDraw,
    waveform.peaks,
    effectiveDuration,
    currentTime,
    sortedSegments,
    draftSegment,
    sortedMarkers,
    selectedBoundaryIndex,
  ]);

  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas || !canDraw) return;

      drawWaveform(canvas, waveform.peaks, {
        duration: effectiveDuration,
        currentTime,
        segments: sortedSegments,
        draftSegment,
        boundaryMarkers: sortedMarkers,
        selectedBoundaryIndex,
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [
    canDraw,
    waveform.peaks,
    effectiveDuration,
    currentTime,
    sortedSegments,
    draftSegment,
    sortedMarkers,
    selectedBoundaryIndex,
  ]);

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!effectiveDuration || effectiveDuration <= 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = clamp(x / rect.width, 0, 1);
    const time = ratio * effectiveDuration;

    if (clickMode === "seek") {
      const marker = findNearestMarker(
        sortedMarkers,
        x,
        effectiveDuration,
        rect.width
      );

      if (marker) {
        onSelectBoundary?.(marker.index);
        onSeek?.(marker.time);
        return;
      }

      onSeek?.(time);
      return;
    }

    if (clickMode === "start") {
      onSetDraftStart?.(time);
      onSeek?.(time);
      return;
    }

    onSetDraftEnd?.(time);
    onSeek?.(time);
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-700">音声波形</div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
          <span>黄: segment</span>
          <span>青: boundary</span>
          <span>緑: draft開始</span>
          <span>赤: draft終了/再生位置</span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-2">
        <div className="mr-1 text-[11px] font-medium text-slate-500">
          波形クリック:
        </div>

        <button
          type="button"
          onClick={() => setClickMode("seek")}
          className={
            clickMode === "seek"
              ? "rounded bg-slate-900 px-2 py-1 text-[11px] font-medium text-white"
              : "rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          }
        >
          移動/選択
        </button>

        <button
          type="button"
          onClick={() => setClickMode("start")}
          className={
            clickMode === "start"
              ? "rounded bg-green-700 px-2 py-1 text-[11px] font-medium text-white"
              : "rounded border border-green-300 bg-white px-2 py-1 text-[11px] font-medium text-green-700 hover:bg-green-50"
          }
        >
          draft開始
        </button>

        <button
          type="button"
          onClick={() => setClickMode("end")}
          className={
            clickMode === "end"
              ? "rounded bg-red-700 px-2 py-1 text-[11px] font-medium text-white"
              : "rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
          }
        >
          draft終了
        </button>

        <div className="ml-auto text-[11px] text-slate-500">
          {clickMode === "seek"
            ? "波形クリックで移動、マーカー近くでboundary選択"
            : clickMode === "start"
              ? "クリック位置をdraft開始点にします"
              : "クリック位置をdraft終了点にします"}
        </div>
      </div>

      {waveform.status === "loading" ? (
        <div className="flex h-[140px] items-center justify-center rounded bg-slate-50 text-xs text-slate-500">
          波形を読み込んでいます…
        </div>
      ) : null}

      {waveform.status === "error" ? (
        <div className="rounded border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
          <div className="font-semibold">波形を表示できませんでした。</div>
          <div className="mt-1">{waveform.errorMessage}</div>
          <div className="mt-2">
            R2のCORS設定、音声URL、またはAudioContextのdecodeに問題がある可能性があります。
          </div>
        </div>
      ) : null}

      {waveform.status === "idle" ? (
        <div className="flex h-[140px] items-center justify-center rounded bg-slate-50 text-xs text-slate-400">
          音声URLを設定すると波形を表示します。
        </div>
      ) : null}

      {canDraw ? (
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="h-[150px] w-full cursor-crosshair rounded bg-slate-50"
          title={
            clickMode === "seek"
              ? "クリックした位置へ移動。boundary近くをクリックすると選択"
              : clickMode === "start"
                ? "クリックした位置をdraft開始点に設定"
                : "クリックした位置をdraft終了点に設定"
          }
        />
      ) : null}

      {waveform.status === "ready" && !canDraw ? (
        <div className="rounded border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
          波形データは読み込めましたが、描画条件を満たしていません。
        </div>
      ) : null}

      <div className="mt-2 text-[11px] text-slate-500">
        status: {waveform.status} / peaks: {waveform.peaks.length} / audio:{" "}
        {duration > 0 ? duration.toFixed(2) : "未取得"}秒 / decoded:{" "}
        {waveform.decodedDuration > 0
          ? waveform.decodedDuration.toFixed(2)
          : "未取得"}秒 / effective:{" "}
        {effectiveDuration > 0 ? effectiveDuration.toFixed(2) : "未取得"}秒
        {waveform.errorMessage ? (
          <span className="mt-1 block text-orange-700">
            error: {waveform.errorMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
}
